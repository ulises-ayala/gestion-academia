import fs from 'node:fs/promises';
import path from 'node:path';
import { loadEnvFile } from 'node:process';

loadEnvFile('.env');
const API_URL = process.env.API_URL ?? 'http://localhost:3001/api/v1';
const username = process.env.IMPORT_ADMIN_USERNAME;
const password = process.env.IMPORT_ADMIN_PASSWORD;

if (!username || !password) {
  console.error(
    '❌ Faltan IMPORT_ADMIN_USERNAME o IMPORT_ADMIN_PASSWORD en las variables de entorno.',
  );
  process.exit(1);
}

async function request(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `${response.status} ${response.statusText}: ${body}`,
    );
  }

  return response.json();
}

async function login() {
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
    const body = await response.text();

    throw new Error(
      `${response.status} ${response.statusText}: ${body}`,
    );
  }

  const data = await response.json();

  console.log('✅ Sesión iniciada.');
  console.log(`👤 Usuario: ${data.user?.username}`);

  const setCookie = response.headers.get('set-cookie');

  if (!setCookie) {
    throw new Error(
      'El login fue exitoso, pero no se recibió ninguna cookie de sesión.',
    );
  }

  const sessionCookie = setCookie.split(';')[0];

  return sessionCookie;
}

async function getAllStudents(sessionCookie) {
  const students = [];

  let page = 1;
  const limit = 25;

  while (true) {
    console.log(`📥 Consultando alumnos - página ${page}...`);

    const url = new URL(`${API_URL}/students`);

    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', String(limit));

    const response = await fetch(url, {
      headers: {
        Cookie: sessionCookie,
      },
    });

    if (!response.ok) {
      const body = await response.text();

      throw new Error(
        `${response.status} ${response.statusText}: ${body}`,
      );
    }

    const data = await response.json();

    const items = Array.isArray(data)
      ? data
      : data.items ??
        data.data ??
        data.results ??
        [];

    console.log(`   ${items.length} alumnos obtenidos.`);

    if (items.length === 0) {
      break;
    }

    students.push(...items);

    if (items.length < limit) {
      break;
    }

    page++;
  }

  return students;
}

function normalizeStudent(student) {
  return {
    id: student.id ?? null,

    dni:
      student.dni ??
      student.documentNumber ??
      null,

    firstName:
      student.firstName ??
      '',

    lastName:
      student.lastName ??
      '',

    fullName: [
      student.lastName,
      student.firstName,
    ]
      .filter(Boolean)
      .join(' ')
      .trim(),

    phone:
      student.phone ??
      null,

    email:
      student.email ??
      null,

    birthDate:
      student.birthDate ??
      null,

    address:
      student.address ??
      null,

    status:
      student.status ??
      null,

    createdAt:
      student.createdAt ??
      null,

    updatedAt:
      student.updatedAt ??
      null,
  };
}

async function saveJson(students) {
  const outputDir = path.resolve('./exports');
  await fs.mkdir(outputDir, { recursive: true });

  const outputPath = path.join(
    outputDir,
    'students-current.json',
  );

  await fs.writeFile(
    outputPath,
    JSON.stringify(students, null, 2),
    'utf8',
  );

  return outputPath;
}

async function main() {
  try {
    const sessionCookie = await login();

    const rawStudents = await getAllStudents(sessionCookie);

    const students = rawStudents.map(normalizeStudent);

    console.log('');
    console.log(`👥 Alumnos encontrados: ${students.length}`);

    const active = students.filter(
      (student) => student.status === 'ACTIVE',
    );

    const inactive = students.filter(
      (student) => student.status === 'INACTIVE',
    );

    console.log(`✅ Activos: ${active.length}`);
    console.log(`⛔ Inactivos: ${inactive.length}`);

    const outputPath = await saveJson(students);

    console.log('');
    console.log('✅ Exportación finalizada.');
    console.log(`📄 Archivo: ${outputPath}`);
  } catch (error) {
    console.error('');
    console.error('❌ Error exportando alumnos:');
    console.error(error.message);

    process.exit(1);
  }
}

await main();