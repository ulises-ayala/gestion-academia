import XLSX from 'xlsx';

const API_URL = 'http://localhost:3001/api/v1';
const DRY_RUN = process.argv.includes('--dry-run');

const username = process.env.IMPORT_ADMIN_USERNAME;
const password = process.env.IMPORT_ADMIN_PASSWORD;

const activityClassMap = {
  'Arabe Infantil': 'Árabe infantil',
  'Bachata Y Salsa Inicial': 'Bachata y Salsa Inicial',
  'Coreografico E.Masc-Bachata/Urban':
    'Coreografico E.Masc-Bachata/Urban',
  'Coreografico_Frank': 'Grupo C. - A.Frank',
  'Coreografico_Puchini': 'Grupo C. Sofi',
  'Estilo Femenino': 'Clase femenino Sofi',
  'Formacion Docente En Ritmos Caribeños Y Kizomba':
    'Formacion Docente En Ritmos Caribeños Y Kizomba',
  Heels: 'Hells',
  'Infantil 1': 'Infantil (6 a 7 años)',
  Kids: 'Kids 4-5 años',
  Kizomba: 'Clase kizomba',
  'Ladys Kizz': 'Ladys Kizz',
  'Ladys Training': 'Clase LT - A.Frank',
  'Mambo En Pareja': 'Mambo en parejas',
  'Salsa Y Bachata En Pareja _Fabi': 'S&B Parejas',
  'Street Coreografico Adulto': 'S.C Adultos (+18 años)',
  'Street Coreografico Avanzado Intermedio':
    'Street Int/Avanzado',
  'Street Coreografico Infantil':
    'S.C Infantil (6-11 años)',
  'Street Coreografico Juvenil':
    'S.C Juvenil (12-17 años)',
  'Tango Inter/Avanz': 'Tango (Inter/Avanz)',
  Teens: 'Teens (8 a 12 años)',
  Zumba: 'Zumba - Profe Joselo',
};

async function login() {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Error de login: ${await response.text()}`,
    );
  }

  const setCookie = response.headers.get('set-cookie');

  if (!setCookie) {
    throw new Error('No se recibió academy_session');
  }

  return setCookie.split(';')[0];
}

async function apiGet(path, sessionCookie) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Cookie: sessionCookie,
    },
  });

  if (!response.ok) {
    throw new Error(
      `${path}: ${await response.text()}`,
    );
  }

  return response.json();
}

function extractItems(data) {
  // Esto permite soportar respuestas del tipo:
  // { items: [...] }
  // o directamente [...]
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;

  return [];
}

/**
 * Leer y consolidar Excel
 */
const workbook = XLSX.readFile(
  './scripts/data/ReporteListaDeSocios.xlsx',
);

const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const rows = XLSX.utils.sheet_to_json(sheet, {
  range: 13,
  defval: '',
});

const cleanRows = rows.filter((row) =>
  Object.values(row).some(
    (value) =>
      value !== '' &&
      value !== undefined &&
      value !== null,
  ),
);

const studentsMap = new Map();

let currentDni = null;

for (const row of cleanRows) {
  const dni = row['DNI/ID']
    ? String(row['DNI/ID']).trim()
    : null;

  if (dni) {
    currentDni = dni;

    if (!studentsMap.has(dni)) {
      studentsMap.set(dni, {
        fullName: row.Nombre?.trim() || '',
        documentNumber: dni,
        activities: [],
      });
    }
  }

  if (currentDni && row.Actividad) {
    const student = studentsMap.get(currentDni);

    const activity = String(row.Actividad).trim();

    if (!student.activities.includes(activity)) {
      student.activities.push(activity);
    }
  }
}

const excelStudents = [...studentsMap.values()];

console.log(
  `📄 Alumnos únicos del Excel: ${excelStudents.length}`,
);

/**
 * Login
 */
console.log('🔐 Iniciando sesión...');

const sessionCookie = await login();

console.log('✅ Sesión iniciada');

/**
 * Obtener alumnos
 */
console.log('👥 Obteniendo alumnos...');

async function getAllStudents(sessionCookie) {
  const allStudents = [];

  let page = 1;

  while (true) {
    const response = await apiGet(
      `/students?page=${page}`,
      sessionCookie,
    );

    const items = response.items ?? [];

    allStudents.push(...items);

    console.log(
      `📄 Página ${page}: ${items.length} alumnos`,
    );

    // Si trae menos de 25, llegamos a la última página
    if (items.length < 25) {
      break;
    }

    page++;
  }

  return allStudents;
}

const dbStudents = await getAllStudents(
  sessionCookie,
);

console.log(
  `✅ Alumnos encontrados en BDD: ${dbStudents.length}`,
);

/**
 * Obtener clases
 */

console.log('📚 Obteniendo clases...');

async function getAllPages(path, sessionCookie, pageSize = 25) {
  const allItems = [];
  let page = 1;

  while (true) {
    const separator = path.includes('?') ? '&' : '?';

    const response = await apiGet(
      `${path}${separator}page=${page}`,
      sessionCookie,
    );

    const items = response.items ?? [];

    allItems.push(...items);

    console.log(
      `📄 ${path} página ${page}: ${items.length} registros`,
    );

    if (items.length < pageSize) {
      break;
    }

    page++;
  }

  return allItems;
}
const dbClasses = await getAllPages(
  '/classes',
  sessionCookie,
);

console.log(
  `✅ Clases encontradas: ${dbClasses.length}`,
);

/**
 * Mapas rápidos
 */
const studentsByDni = new Map(
  dbStudents.map((student) => [
    String(student.dni).trim(),
    student,
  ]),
);

const classesByName = new Map(
  dbClasses.map((classItem) => [
    String(classItem.name).trim(),
    classItem,
  ]),
);

/**
 * Contadores
 */
let simulated = 0;
let created = 0;
let failed = 0;
let missingStudents = 0;
let missingClasses = 0;
let inactiveClasses = 0;

/**
 * Crear enrollments
 */

const IMPORT_START_DATE = '2026-08-28';

for (const excelStudent of excelStudents) {
  const dbStudent = studentsByDni.get(
    excelStudent.documentNumber,
  );

  if (!dbStudent) {
    console.warn(
      `⚠ Alumno no encontrado: ${excelStudent.fullName} - DNI ${excelStudent.documentNumber}`,
    );

    missingStudents++;
    continue;
  }

  for (const activity of excelStudent.activities) {
    const targetClassName = activityClassMap[activity];

    if (!targetClassName) {
      console.warn(
        `⚠ Actividad sin mapeo: "${activity}"`,
      );

      missingClasses++;
      continue;
    }

    const classItem = classesByName.get(
      targetClassName,
    );

    if (!classItem) {
      console.warn(
        `⚠ Clase no encontrada: "${targetClassName}"`,
      );

      missingClasses++;
      continue;
    }

    /**
     * Si querés NO importar alumnos a clases inactivas:
     */
    if (classItem.status === 'INACTIVE') {
      console.warn(
        `⚠ Clase inactiva, se omite: ${excelStudent.fullName} → ${targetClassName}`,
      );

      inactiveClasses++;
      continue;
    }

    const payload = {
      studentId: dbStudent.id,
      classId: classItem.id,
      startDate: IMPORT_START_DATE,
    };

    if (DRY_RUN) {
      console.log(
        `🔎 Se inscribiría: ${excelStudent.fullName} → ${targetClassName}| inicio: ${IMPORT_START_DATE}`,
      );

      simulated++;
      continue;
    }

    console.log(
      `📤 Inscribiendo ${excelStudent.fullName} → ${targetClassName}`,
    );

    try {
      const response = await fetch(
        `${API_URL}/enrollments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: sessionCookie,
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        console.error(
          `❌ Error: ${excelStudent.fullName} → ${targetClassName}:`,
          await response.text(),
        );

        failed++;
        continue;
      }

      console.log(
        `✅ ${excelStudent.fullName} → ${targetClassName}`,
      );

      created++;
    } catch (error) {
      console.error(
        `❌ Error inesperado: ${excelStudent.fullName} → ${targetClassName}`,
        error,
      );

      failed++;
    }
  }
}

/**
 * Resumen
 */
console.log('');
console.log('==================================');
console.log(
  DRY_RUN
    ? 'SIMULACIÓN DE INSCRIPCIONES'
    : 'IMPORTACIÓN DE INSCRIPCIONES',
);
console.log('==================================');

if (DRY_RUN) {
  console.log(`Simuladas:              ${simulated}`);
} else {
  console.log(`Creadas:                ${created}`);
  console.log(`Errores:                ${failed}`);
}

console.log(
  `Alumnos no encontrados: ${missingStudents}`,
);
console.log(
  `Clases no encontradas:  ${missingClasses}`,
);
console.log(
  `Clases inactivas:       ${inactiveClasses}`,
);

console.log('==================================');