# Gestión Academia

## Caja por turno

Cada cobro requiere un turno propio abierto y alimenta Caja automáticamente con un movimiento por cada medio de pago. El cierre conserva por medio lo esperado según cobros, lo declarado y la diferencia; anulaciones y correcciones posteriores agregan historia sin reescribir el cierre original. Esta versión no incluye fondo inicial, ingresos, gastos ni backfill de pagos históricos.

Sistema administrativo para una academia de baile, construido como monorepo TypeScript y monolito modular. El incremento actual incluye autenticación, Alumnos v1, Oferta Académica v1, Inscripciones v1, Tarifas/Cuotas v1, Pagos v2 core y Caja por turno v1.

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
Tarifas/Cuotas v1 permite administrar tarifas y generar manualmente una cuota mensual por inscripción activa. Pagos v2 core admite cobros parciales, imputa automáticamente a la deuda más antigua y combina efectivo, Mercado Pago y tarjeta, preservando imputaciones, medios, actor y anulaciones. Caja por turno v1 deriva sus movimientos de esos cobros. Asistencias de alumnos v1 permite tomar y corregir asistencia. No están implementados saldo a favor, devoluciones, Formación, asistencia docente, control de acceso ni liquidaciones.

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

## Seed de staging

Staging dispone de un comando administrativo separado que carga exclusivamente datos ficticios en una base PostgreSQL llamada exactamente `academy_staging`. Es manual, idempotente, nunca forma parte del build, CI, migraciones, deploy o arranque, y no borra ni modifica registros ajenos al conjunto reservado del seed.

Debe ejecutarse en un entorno que ya proporcione `DATABASE_URL` (no carga un archivo `.env`) y exige simultáneamente:

```text
NODE_ENV=production
ALLOW_STAGING_SEED=true
STAGING_SEED_TARGET=academy_staging
STAGING_SEED_CONFIRM=SEED_ACADEMY_STAGING
STAGING_SEED_PASSWORD=<secret>
```

`STAGING_SEED_PASSWORD` no tiene valor predeterminado, debe cumplir la validación de la aplicación (entre 12 y 200 caracteres), se procesa con el mismo hash `scrypt` y nunca se imprime. Las cuentas reservadas son `demo-admision`, `demo-administracion` y `demo-direccion`; así no se pisan cuentas administrativas creadas manualmente.

Después de configurar esas variables explícitamente en el entorno administrativo de staging, ejecutar:

```bash
npm run db:seed:staging
```

El comando comprueba el protocolo y extrae de `DATABASE_URL` el nombre real de la base; rechaza `academy`, cualquier nombre productivo y variantes como `academy_staging_backup`.

## API de alumnos

- `GET /api/v1/students?q=&status=&page=1&pageSize=25`: buscar, filtrar y paginar.
- `POST /api/v1/students`: crear.
- `POST /api/v1/students/onboarding`: crear un alumno y, opcionalmente, sus inscripciones, cuotas iniciales y un único pago.
- `GET /api/v1/students/:id`: obtener ficha.
- `PATCH /api/v1/students/:id`: editar datos o estado.
- `DELETE /api/v1/students/:id`: desactivar sin borrar.
- `POST /api/v1/students/:id/reactivate`: reactivar.

La pantalla **Nuevo alumno** conserva el alta sin clases y permite agregar una o varias clases con una tarifa por clase. Cada selección genera una inscripción y una cuota mensual completa, sin prorrateo. El cobro inicial es opcional; si se cobra, la API calcula el total de las cuotas y crea un solo pago con sus imputaciones. Todo el flujo compuesto se confirma o revierte como una única operación.

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
- `GET /api/v1/monthly-charges?studentId=&period=`: listar por alumno y/o período, incluyendo `paidAmount`, `outstandingAmount` y el vencimiento derivado.
- `GET /api/v1/monthly-charges/:id`: obtener detalle.
- `GET/POST /api/v1/enrollments/:id/billing-conditions`: consultar o crear becas y descuentos recurrentes.
- `POST /api/v1/billing-conditions/:id/end`: finalizar una condición conservando su historia.
- `POST /api/v1/billing-conditions/:id/renew`: renovar mediante una nueva condición enlazada.
- `POST /api/v1/monthly-charges/:chargeId/adjustments/:adjustmentId/reverse`: corregir con una reversa append-only.

Cada cuota conserva el importe tarifario y snapshots de los ajustes vigentes. `studentDueAmount` es la deuda ajustada y `settlementBaseAmount` la base futura para liquidaciones; puede pasar a `PARTIAL` o `PAID` según las imputaciones confirmadas. Las cuotas vencidas con saldo incorporan un recargo fijo de ARS 1.000, que se materializa de forma idempotente al cobrar. No existe generación automática.

## API de pagos

- `GET /api/v1/payments?studentId=&status=&paymentMethod=&page=1&pageSize=25`: listar pagos paginados.
- `GET /api/v1/payments/:id`: consultar un pago con sus imputaciones.
- `POST /api/v1/payments`: cobrar con `{ studentId, tenders: [{ method, amount }] }`.
- `POST /api/v1/payments/:id/void`: anular sin borrar medios ni imputaciones y recalcular cada cuota con los demás pagos confirmados.

El importe total es la suma exacta de los medios y de las imputaciones; el servidor distribuye sobre la deuda ajustada por `dueDate`, `createdAt` e `id` ascendentes. Un pago puede cubrir parcialmente una cuota y derramar el resto sobre las siguientes. Se rechaza todo total superior a la deuda vigente y no se genera saldo a favor. La creación se serializa por alumno, materializa primero cualquier recargo vencido y recalcula la deuda dentro de la transacción. Requiere un turno abierto y crea movimientos de Caja por tender; no incluye devoluciones ni transferencia bancaria.

## API de asistencias

- `GET /api/v1/attendances/roster?classId=&date=AAAA-MM-DD`: roster vigente con asistencia existente.
- `GET /api/v1/attendances/quick-search?q=&date=AAAA-MM-DD`: buscar alumnos y sus clases vigentes con contexto suficiente para ingreso rápido.
- `GET /api/v1/attendances?classId=&date=AAAA-MM-DD`: consultar historial por clase y/o fecha.
- `POST /api/v1/attendances`: registrar asistencia para una inscripción y fecha.
- `GET /api/v1/attendances/:id`: consultar una asistencia.
- `PATCH /api/v1/attendances/:id`: corregir solamente estado y observación.

Todos los endpoints requieren `attendance:manage`. No existe borrado físico.

## Roles y permisos

Los roles administrativos son acumulativos: **Admisión** (`RECEPTION`) se ocupa de la operación cotidiana; **Administración** (`MANAGER`) hereda Admisión y agrega capacidades de gestión y configuración; **Dirección** (`ADMINISTRATOR`) es el nivel más alto, hereda Administración y agrega acciones sensibles.

| Capacidad                        | Admisión (`RECEPTION`) | Administración (`MANAGER`) | Dirección (`ADMINISTRATOR`) |
| -------------------------------- | :--------------------: | :------------------------: | :-------------------------: |
| Gestionar alumnos                |           ✅           |             ✅             |             ✅              |
| Gestionar inscripciones          |           ✅           |             ✅             |             ✅              |
| Consultar oferta académica       |           ✅           |             ✅             |             ✅              |
| Administrar oferta académica     |           —            |             ✅             |             ✅              |
| Consultar tarifas                |           ✅           |             ✅             |             ✅              |
| Administrar tarifas              |           —            |             ✅             |             ✅              |
| Consultar cuotas                 |           ✅           |             ✅             |             ✅              |
| Administrar cuotas               |           —            |             ✅             |             ✅              |
| Consultar pagos                  |           ✅           |             ✅             |             ✅              |
| Registrar/cobrar pagos           |           ✅           |             ✅             |             ✅              |
| Anular pagos                     |           —            |             ✅             |             ✅              |
| Gestionar caja propia            |           ✅           |             ✅             |             ✅              |
| Arqueos/reconciliación           |           —            |             ✅             |             ✅              |
| Gestionar asistencias            |           ✅           |             ✅             |             ✅              |
| Gestionar usuarios               |           —            |             —              |             ✅              |
| Gestionar usuarios de Dirección  |           —            |             —              |             ✅              |
| Vender indumentaria              |           ✅           |             ✅             |             ✅              |
| Administrar inventario           |           —            |             ✅             |             ✅              |
| Registrar alumnos en formaciones |           ✅           |             ✅             |             ✅              |
| Administrar formaciones          |           —            |             ✅             |             ✅              |
| Reportes operativos              |           —            |             ✅             |             ✅              |
| Reportes completos               |           —            |             —              |             ✅              |
| Gestionar liquidaciones          |           —            |             ✅             |             ✅              |
| Aprobar liquidaciones            |           —            |             —              |             ✅              |

Algunos permisos ya están definidos como parte de la matriz de autorización aunque los módulos correspondientes todavía no estén implementados completamente.

La API es la autoridad real de permisos. Ocultar módulos, opciones o acciones en el frontend mejora la experiencia de uso, pero no reemplaza la validación de autorización en el backend.

### Gestión de usuarios

- `GET /api/v1/users`: listar usuarios y sus niveles de acceso (sólo Dirección).
- `GET /api/v1/users/:id`: consultar.
- `POST /api/v1/users`: crear.
- `PATCH /api/v1/users/:id`: cambiar usuario, contraseña, rol o estado.

No se eliminan usuarios físicamente. Solamente Dirección puede administrar cuentas y roles. Una cuenta no puede desactivarse ni cambiar su propio rol, siempre debe quedar una cuenta activa de Dirección y toda desactivación requiere confirmar la contraseña actual de quien realiza la acción.

## Próxima etapa

El siguiente incremento recomendado es **Pagos**, solamente después de confirmar imputaciones, anulaciones, recibos y métodos de pago. Antes de pagos, caja y liquidaciones debe definirse la matriz concreta de permisos.
