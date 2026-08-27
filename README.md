# Gestión Academia

Sistema administrativo para una academia de baile, construido como monorepo TypeScript y monolito modular. El incremento actual incluye autenticación, Alumnos v1, Oferta Académica v1, Inscripciones v1 y Tarifas/Cuotas v1.

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
- Autorización por nivel: Admisión, Administración y Dirección, aplicada en API y navegación.
- Contraseñas derivadas con `scrypt`; tokens de sesión almacenados solamente como hash.
- Cookie `HttpOnly`, `SameSite=Lax` y expiración configurable.
- Alumnos v1: alta, ficha, edición, baja lógica, reactivación, búsqueda, filtros y paginación server-side.
- Profesores: ficha, búsqueda, paginación y ciclo activo/inactivo.
- Oferta académica: tipos de danza, sucursales, salones, clases y múltiples horarios normalizados.
- Detección transaccional de conflictos de salón y profesor; horarios contiguos permitidos.
- PostgreSQL 16 y migraciones Prisma.
- Pruebas unitarias y HTTP, incluido el límite de autenticación del módulo de alumnos.

Inscripciones v1 permite inscribir, finalizar preservando historial, consultar alumnos por clase y controlar cupos de forma transaccional. El cupo de una clase no puede reducirse por debajo de sus inscripciones activas.
Tarifas/Cuotas v1 permite administrar tarifas y generar manualmente una cuota mensual por inscripción activa. Los montos quedan congelados en cada cuota. Asistencias de alumnos v1 permite tomar y corregir asistencia sobre el roster vigente de una clase y fecha. No están implementados pagos, caja, descuentos, promociones, Formación, asistencia docente, control de acceso ni liquidaciones.

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

### Datos locales de desarrollo

Con PostgreSQL local levantado y las migraciones aplicadas, se puede cargar un conjunto reproducible de datos ficticios:

```bash
npm run db:seed
```

El comando es manual, idempotente y exclusivo de desarrollo. Se cancela si `NODE_ENV` no es `development`, si corre en CI o si `DATABASE_URL` no apunta por `localhost`, `127.0.0.1` o `::1` a una base PostgreSQL llamada `academy`. No se ejecuta durante builds, migraciones ni despliegues.

La contraseña común de los usuarios de prueba se toma de `DEV_SEED_PASSWORD`; `.env.example` incluye `AcademiaDev2026!` como valor exclusivamente local. Los accesos disponibles son:

- `admision` (`RECEPTION`, nivel Admisión).
- `administracion` (`MANAGER`, nivel Administración).
- `direccion` (`ADMINISTRATOR`, nivel Dirección).

El dataset incluye 28 alumnos, 6 profesores, 4 tipos de danza, 2 sedes, 4 salones, 9 clases con horarios, inscripciones activas/finalizadas, cuotas y asistencias. Las fechas se calculan según el día actual de Buenos Aires. Entre los casos preparados para QA están Ana Pérez (una clase, cuota pendiente y sin asistencia de hoy), Bruno Gómez (dos clases y asistencia ya cargada hoy), Carla Rodríguez (historial sobre inscripción finalizada) y Diego Fernández (sin inscripciones). Volver a ejecutar el comando actualiza estos registros reservados sin duplicarlos y sin borrar datos creados manualmente.

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

## Integración continua

El workflow `.github/workflows/ci.yml` se ejecuta para cada `push` y `pull_request` dirigido a `main`. Usa Node.js 22 con caché de npm e instala exactamente las dependencias del lockfile mediante `npm ci`.

La pipeline ejecuta, en orden:

```bash
npm ci
npm run db:generate
npm run format:check
npm run lint
npm run typecheck
npx prisma validate --schema packages/database/prisma/schema.prisma
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
npm test
npm run build
```

Durante el job se inicia un service container efímero de PostgreSQL 16. `DATABASE_URL` apunta exclusivamente a la base `academy_ci` del contenedor y usa credenciales fijas sin valor fuera de CI; no lee `.env`, la base local ni secretos reales. Después de instalar las dependencias se genera el cliente Prisma requerido por TypeScript y `prisma migrate deploy` aplica desde cero todas las migraciones versionadas antes de ejecutar las pruebas.

## Staging en Render

`render.yaml` prepara exclusivamente el entorno de staging para demos y pruebas funcionales:

```text
GitHub main
    -> Render Blueprint
       +-> gestion-academia-staging-web
       +-> gestion-academia-staging-api
       +-> gestion-academia-staging-db
```

Los dos servicios Node se construyen desde la raíz del repositorio para conservar npm workspaces. Render espera que pasen los checks de GitHub antes de desplegar un commit de `main`.

### Comandos de despliegue

| Recurso   | Build                      | Start                      |
| --------- | -------------------------- | -------------------------- |
| API       | `npm run render:build:api` | `npm run render:start:api` |
| Admin web | `npm run render:build:web` | `npm run render:start:web` |

El build de la API ejecuta `npm ci --include=dev`, genera Prisma Client y compila NestJS. `--include=dev` mantiene disponibles las herramientas de compilación aunque el runtime use `NODE_ENV=production`. Su start ejecuta primero `prisma migrate deploy` y luego `node dist/main.js`. Esta estrategia se usa porque Render no ofrece `preDeployCommand` para servicios web gratuitos. El comando de migración es incremental: no usa `migrate dev`, `db push` ni reset, y no borra datos existentes.

El frontend ejecuta `npm ci --include=dev`, `next build` y `next start`. Tanto NestJS como Next.js respetan el `PORT` asignado por Render; localmente la API conserva el puerto 3001.

### Crear el Blueprint

1. Crear una cuenta o workspace en Render y conectar la cuenta de GitHub con acceso a este repositorio.
2. En Render, elegir **New > Blueprint**, seleccionar el repositorio y la rama `main`, y confirmar que la ruta del Blueprint sea `render.yaml`.
3. Durante la creación, cargar `ADMIN_ORIGINS` con la URL HTTPS exacta del servicio web, por ejemplo `https://gestion-academia-staging-web.onrender.com`, sin barra final.
4. Cargar `NEXT_PUBLIC_API_URL` con la URL HTTPS pública completa de la API y un único sufijo `/api/v1`, por ejemplo `https://gestion-academia-staging-api.onrender.com/api/v1`.
5. Aplicar/sincronizar el Blueprint. Si las URLs definitivas asignadas por Render difieren de las previstas, corregir ambas variables en el Dashboard y desplegar nuevamente los servicios. `NEXT_PUBLIC_API_URL` debe estar presente durante el build de Next.js.
6. Confirmar en el log de la API que `prisma migrate deploy` aplicó todas las migraciones. No ejecutar un reset.
7. Abrir `https://<api>/api/v1/health` y comprobar una respuesta HTTP 200 con `{"status":"ok","service":"academy-api"}`.
8. Abrir el frontend, completar una sola vez el alta del primer administrador y probar login/logout.
9. Crear manualmente datos ficticios desde el panel: sucursal, salones, profesores, tipos de danza, clases, alumnos e inscripciones. No usar datos personales reales. No hay un seed automático en este incremento.

`DATABASE_URL` se completa mediante `fromDatabase.connectionString`; no se carga manualmente ni se copia a un `.env`. Render también proporciona `PORT` en runtime. El Blueprint fija `NODE_ENV=production`, `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAME_SITE=none`, `AUTH_SESSION_HOURS=12` y `BUSINESS_TIMEZONE=America/Buenos_Aires`.

### CORS y sesiones

La API acepta una lista separada por comas en `ADMIN_ORIGINS` y habilita credenciales solamente para esos orígenes. Desarrollo usa `http://localhost:3000` por defecto. El navegador ya envía las solicitudes con `credentials: include`.

En los subdominios independientes `*.onrender.com`, la cookie necesita `SameSite=None; Secure`, configuración incluida para staging. Algunos navegadores o políticas corporativas bloquean por completo cookies de terceros aun con esos atributos. Si ocurre, la solución estable es asignar dominios personalizados HTTPS bajo el mismo sitio registrable, por ejemplo `admin.staging.ejemplo.com` y `api.staging.ejemplo.com`, y actualizar `ADMIN_ORIGINS` y `NEXT_PUBLIC_API_URL`. No se deben mover tokens a `localStorage`.

### Troubleshooting

- **La API no encuentra PostgreSQL:** comprobar que `DATABASE_URL` siga vinculada a `gestion-academia-staging-db` mediante `fromDatabase`, que ambos recursos estén disponibles y que no se haya reemplazado por una URL local.
- **Faltan tipos o Prisma Client:** verificar en el build de API que termine `npm run db:generate`; no subir `node_modules` ni `.prisma`.
- **Error CORS:** `ADMIN_ORIGINS` debe contener el origin exacto (`https`, hostname y puerto si corresponde), sin rutas ni barra final. Para varios origins, separarlos con comas.
- **El login no conserva la sesión:** comprobar HTTPS, `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAME_SITE=none`, CORS con el origin exacto y que el navegador no bloquee cookies de terceros. Para evitar esta última limitación, usar dominios personalizados del mismo sitio.
- **El frontend intenta acceder a localhost:** corregir `NEXT_PUBLIC_API_URL` y reconstruir/redeployar el frontend; las variables `NEXT_PUBLIC_*` se incorporan durante `next build`.
- **Fallan migraciones:** revisar el log del start de API y el estado de las migraciones versionadas. Corregir la migración; no usar `migrate dev`, `db push` ni reset en staging.

El Blueprint usa los planes gratuitos para minimizar costo. Los web services gratuitos pueden suspenderse por inactividad y PostgreSQL gratuito tiene límites de capacidad y vigencia definidos por Render; revisar las condiciones actuales antes de crear los recursos. Subir de plan, agregar dominios personalizados o conservar una base más allá del período gratuito puede generar cargos. Este Blueprint no crea producción ni entornos de preview.

## API de inscripciones

- `GET /api/v1/enrollments?studentId=&classId=&status=`: listar y filtrar.
- `POST /api/v1/enrollments`: crear con `studentId`, `classId` y `startDate`.
- `GET /api/v1/enrollments/:id`: obtener detalle.
- `POST /api/v1/enrollments/:id/end`: finalizar con `endDate` sin borrar historia.

## API de tarifas y cuotas

- `GET /api/v1/tariffs?status=`: listar tarifas.
- `GET /api/v1/tariffs/active`: listar tarifas activas.
- `GET /api/v1/tariffs/:id`: obtener una tarifa.
- `POST /api/v1/tariffs`: crear con `name`, `amount`, `validFrom` y `validTo` opcional.
- `PATCH /api/v1/tariffs/:id`: editar una tarifa.
- `DELETE /api/v1/tariffs/:id`: desactivar sin borrar.
- `POST /api/v1/tariffs/:id/reactivate`: reactivar.
- `POST /api/v1/monthly-charges`: generar manualmente con `enrollmentId`, `tariffId`, `period` (`AAAA-MM`) y `dueDate`.
- `GET /api/v1/monthly-charges?studentId=&period=`: listar por alumno y/o período.
- `GET /api/v1/monthly-charges/:id`: obtener detalle.

Cada cuota nace `PENDING`, con descuento cero y montos históricos. No hay endpoints de pago, anulación ni generación automática.

## API de asistencias

- `GET /api/v1/attendances/roster?classId=&date=AAAA-MM-DD`: roster vigente con asistencia existente.
- `GET /api/v1/attendances/quick-search?q=&date=AAAA-MM-DD`: buscar alumnos y sus clases vigentes con contexto suficiente para ingreso rápido.
- `GET /api/v1/attendances?classId=&date=AAAA-MM-DD`: consultar historial por clase y/o fecha.
- `POST /api/v1/attendances`: registrar asistencia para una inscripción y fecha.
- `GET /api/v1/attendances/:id`: consultar una asistencia.
- `PATCH /api/v1/attendances/:id`: corregir solamente estado y observación.

Todos los endpoints requieren `attendance:manage`. No existe borrado físico.

## Usuarios y permisos

Los valores internos se presentan de esta manera:

- `RECEPTION`: Admisión.
- `MANAGER`: Administración.
- `ADMINISTRATOR`: Dirección.

Admisión opera alumnos e inscripciones y consulta clases, tarifas y cuotas. Administración agrega configuración académica, gestión de tarifas y usuarios de Admisión/Administración. Dirección agrega la gestión de cuentas de Dirección y las capacidades reservadas de aprobación/reportes completos.

- `GET /api/v1/users`: listar usuarios permitidos para el nivel actual.
- `GET /api/v1/users/:id`: consultar.
- `POST /api/v1/users`: crear.
- `PATCH /api/v1/users/:id`: cambiar usuario, contraseña, rol o estado.

No se eliminan usuarios físicamente. Una cuenta no puede desactivarse ni cambiar su propio rol, y siempre debe quedar una cuenta activa de Dirección. El frontend oculta módulos/acciones no habilitados, pero la autorización efectiva siempre se controla en la API.

## Próxima etapa

El siguiente incremento recomendado es **Pagos**, solamente después de confirmar imputaciones, anulaciones, recibos y métodos de pago. Antes de pagos, caja y liquidaciones debe definirse la matriz concreta de permisos.
