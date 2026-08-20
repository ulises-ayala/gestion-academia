# Gestión Academia

Sistema administrativo para una academia de baile, construido como monorepo TypeScript y monolito modular. El incremento actual incluye autenticación, Alumnos v1, Oferta Académica v1 e Inscripciones v1.

## Arquitectura

```text
apps/admin-web --HTTP/JSON--> apps/api --Prisma--> PostgreSQL
futura app alumno ----------------^          |
                                             +-- módulos de dominio
```

- `apps/api`: API REST NestJS versionada bajo `/api/v1`, con autenticación, validación y traducción centralizada de errores.
- `apps/admin-web`: panel administrativo Next.js; consume exclusivamente la API.
- `packages/database`: esquema, migraciones y cliente Prisma.
- `packages/contracts`: DTO públicos compartidos; no expone Prisma ni entidades internas.
- `docs`: modelo de dominio, decisiones, ambigüedades y plan incremental.

## Estado actual

- Autenticación administrativa con primer usuario, login, logout, roles iniciales y sesiones opacas.
- Contraseñas derivadas con `scrypt`; tokens de sesión almacenados solamente como hash.
- Cookie `HttpOnly`, `SameSite=Lax` y expiración configurable.
- Alumnos v1: alta, ficha, edición, baja lógica, reactivación, búsqueda, filtros y paginación server-side.
- Profesores: ficha, búsqueda, paginación y ciclo activo/inactivo.
- Oferta académica: tipos de danza, sucursales, salones, clases y múltiples horarios normalizados.
- Detección transaccional de conflictos de salón y profesor; horarios contiguos permitidos.
- PostgreSQL 16 y migraciones Prisma.
- Pruebas unitarias y HTTP, incluido el límite de autenticación del módulo de alumnos.

Inscripciones v1 permite inscribir, finalizar preservando historial, consultar alumnos por clase y controlar cupos de forma transaccional. El cupo de una clase no puede reducirse por debajo de sus inscripciones activas. No están implementados tarifas, cuotas, pagos, caja, asistencias, control de acceso ni liquidaciones.

## Stack

- Node.js 22+, TypeScript estricto y npm workspaces.
- NestJS, Next.js, PostgreSQL, Prisma y Vitest.
- Docker Compose solamente para PostgreSQL local.

## Puesta en marcha

Requiere Node.js 22+, npm 10+, Docker y Docker Compose.

```bash
cp .env.example .env
npm install
docker compose up -d db
npm run db:generate
npm run db:migrate
npm run dev
```

En PowerShell, use `Copy-Item .env.example .env`. Si la política de ejecución bloquea `npm.ps1`, use `npm.cmd`.

- Panel: `http://localhost:3000`
- API: `http://localhost:3001/api/v1`
- Salud: `GET http://localhost:3001/api/v1/health`

En el primer ingreso, el panel solicita crear el administrador inicial. La contraseña debe tener al menos 12 caracteres. El bootstrap se deshabilita después de crear ese usuario.

## API de alumnos

- `GET /api/v1/students?q=&status=&page=1&pageSize=25`: buscar, filtrar y paginar.
- `POST /api/v1/students`: crear.
- `GET /api/v1/students/:id`: obtener ficha.
- `PATCH /api/v1/students/:id`: editar datos o estado.
- `DELETE /api/v1/students/:id`: desactivar sin borrar.
- `POST /api/v1/students/:id/reactivate`: reactivar.

Todos estos endpoints requieren una sesión administrativa activa.

## API de oferta académica

- `/api/v1/teachers`: CRUD lógico, búsqueda y paginación.
- `/api/v1/dance-types`: administrar tipos de danza.
- `/api/v1/branches`: administrar sucursales.
- `/api/v1/rooms?branchId=`: administrar y filtrar salones.
- `/api/v1/classes`: CRUD lógico de clases con filtros y horarios transaccionales.

Cada recurso admite consulta, alta, edición, desactivación y reactivación. Las clases se crean con uno o más horarios `{ dayOfWeek, startTime, endTime, roomId }`.

## Calidad

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

## API de inscripciones

- `GET /api/v1/enrollments?studentId=&classId=&status=`: listar y filtrar.
- `POST /api/v1/enrollments`: crear con `studentId`, `classId` y `startDate`.
- `GET /api/v1/enrollments/:id`: obtener detalle.
- `POST /api/v1/enrollments/:id/end`: finalizar con `endDate` sin borrar historia.

## Próxima etapa

El siguiente incremento recomendado es **Tarifas y Cuotas**. No está implementado todavía. Antes de módulos sensibles como tarifas, pagos, caja y liquidaciones, debe definirse la matriz concreta de permisos.
