# Gestión Academia

Sistema administrativo para una academia de baile, construido como monorepo TypeScript y monolito modular. El incremento actual incluye autenticación administrativa y el módulo Alumnos v1.

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
- PostgreSQL 16 y migraciones Prisma.
- Pruebas unitarias y HTTP, incluido el límite de autenticación del módulo de alumnos.

No están implementados profesores, oferta académica, inscripciones, tarifas, cuotas, pagos, caja, asistencias, control de acceso ni liquidaciones.

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

## Calidad

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Próxima etapa

Antes de implementar administración de usuarios o módulos sensibles como tarifas, pagos, caja y liquidaciones, debe definirse la matriz concreta de permisos. Las reglas de negocio marcadas como ambiguas en [decisions.md](docs/decisions.md) no deben implementarse sin confirmación.
