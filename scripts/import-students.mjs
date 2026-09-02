import XLSX from 'xlsx';

const API_URL = 'http://localhost:3001/api/v1';

const DRY_RUN = process.argv.includes('--dry-run');

const username = process.env.IMPORT_ADMIN_USERNAME;
const password = process.env.IMPORT_ADMIN_PASSWORD;

/**
 * Inicia sesión en la API y devuelve la cookie de sesión.
 */
async function login() {
  if (!username || !password) {
    throw new Error(
      'Faltan IMPORT_ADMIN_USERNAME o IMPORT_ADMIN_PASSWORD en el .env',
    );
  }

  console.log('🔐 Iniciando sesión...');

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
    const error = await response.text();

    throw new Error(
      `No se pudo iniciar sesión (${response.status}): ${error}`,
    );
  }

  const setCookie = response.headers.get('set-cookie');

  if (!setCookie) {
    throw new Error(
      'La API inició sesión pero no devolvió la cookie academy_session.',
    );
  }

  // Nos quedamos únicamente con:
  // academy_session=xxxxxxxx
  const sessionCookie = setCookie.split(';')[0];

  console.log('✅ Sesión iniciada correctamente');

  return sessionCookie;
}

/**
 * Leer Excel
 */
const workbook = XLSX.readFile(
  './scripts/data/ReporteListaDeSocios.xlsx',
);

const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const rows = XLSX.utils.sheet_to_json(sheet, {
  range: 13, // fila 14 del Excel
  defval: '',
});
const cleanRows = rows.filter((row) =>
  Object.values(row).some((value) => {
    return value !== '' && value !== undefined && value !== null;
  }),
);
console.log(`📄 Filas encontradas: ${cleanRows.length}`);

if (DRY_RUN) {
  console.log('🔎 MODO DRY-RUN');
  console.log('No se realizarán cambios en la base de datos.');
}

/**
 * En dry-run no necesitamos autenticarnos porque
 * no vamos a realizar POST.
 */
let sessionCookie = null;

if (!DRY_RUN) {
  try {
    sessionCookie = await login();
  } catch (error) {
    console.error('❌ Error de autenticación:', error.message);
    process.exit(1);
  }
}

let imported = 0;
let failed = 0;
let simulated = 0;

const studentsMap = new Map();

let currentDni = null;

for (const row of cleanRows) {
  const dni = row['DNI/ID']
    ? String(row['DNI/ID']).trim()
    : null;

  /**
   * Nueva persona
   */
  if (dni) {
    currentDni = dni;

    if (!studentsMap.has(dni)) {
      studentsMap.set(dni, {
        fullName: row.Nombre?.trim() || '',
        documentNumber: dni,

        phone: row['Teléfono']
          ? String(row['Teléfono']).trim()
          : undefined,

        email:
          row.Mail && row.Mail !== 'Sin dato'
            ? String(row.Mail).trim()
            : undefined,

        birthDate:
          row['Fecha nacim.'] &&
          row['Fecha nacim.'] !== '-'
            ? row['Fecha nacim.']
            : undefined,

        address:
          row.Domicilio &&
          row.Domicilio !== 'Sin dato'
            ? row.Domicilio.trim()
            : undefined,

        activities: [],
      });
    }
  }

  /**
   * Actividad correspondiente al alumno actual
   */
  if (currentDni && row.Actividad) {
    const student = studentsMap.get(currentDni);

    student.activities.push(
      String(row.Actividad).trim(),
    );
  }
}

const students = [...studentsMap.values()];
console.log(`Alumnos únicos: ${students.length}`);

function splitFullName(fullName) {
  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: '',
    };
  }

  return {
    lastName: parts[0],
    firstName: parts.slice(1).join(' '),
  };
};

function normalizeDate(value) {
  if (!value) return undefined;

  const [day, month, year] = value.split('/');

  if (!day || !month || !year) {
    return undefined;
  }

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

for (const student of students) {
  const { firstName, lastName } = splitFullName(student.fullName);

  const payload = {
    dni: student.documentNumber,
    firstName,
    lastName,
    birthDate: normalizeDate(student.birthDate) ?? null,
    phone: student.phone ?? null,
    email: student.email ?? null,
    address: student.address ?? null,
    };

  // SOLO si ejecutaste con --dry-run
  if (DRY_RUN) {
    console.log('🔎 Payload final:', payload);
    simulated++;
    continue;
  }

  // Si NO es dry-run, tiene que llegar acá
  console.log(
    `📤 Importando ${payload.firstName} ${payload.lastName}...`,
  );

  try {
    const response = await fetch(`${API_URL}/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();

      console.error(
        `❌ Error importando ${payload.firstName} ${payload.lastName}:`,
        error,
      );

      failed++;
      continue;
    }

    console.log(
      `✅ ${payload.firstName} ${payload.lastName}`,
    );

    imported++;
  } catch (error) {
    console.error(
      `❌ Error inesperado con ${payload.firstName} ${payload.lastName}:`,
      error,
    );

    failed++;
  }
}


/**
 * Resumen
 */
console.log('');
console.log('==============================');
console.log('IMPORTACIÓN FINALIZADA');
console.log('==============================');

if (DRY_RUN) {
  console.log(`Simulados: ${simulated}`);
} else {
  console.log(`Importados: ${imported}`);
  console.log(`Errores:    ${failed}`);
}

console.log('==============================');