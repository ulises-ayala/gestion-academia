# Staging en Render

`render.yaml` prepara exclusivamente el entorno de staging para demos y pruebas funcionales:

```text
GitHub main
    -> Render Blueprint
       +-> gestion-academia-staging-web
       +-> gestion-academia-staging-api
       +-> gestion-academia-staging-db
```

Los dos servicios Node se construyen desde la raíz del repositorio para conservar npm workspaces. Render espera que pasen los checks de GitHub antes de desplegar un commit de `main`.

## Comandos de despliegue

| Recurso   | Build                      | Start                      |
| --------- | -------------------------- | -------------------------- |
| API       | `npm run render:build:api` | `npm run render:start:api` |
| Admin web | `npm run render:build:web` | `npm run render:start:web` |

El build de la API ejecuta `npm ci --include=dev`, genera Prisma Client y compila NestJS. `--include=dev` mantiene disponibles las herramientas de compilación aunque el runtime use `NODE_ENV=production`. Su start ejecuta primero `prisma migrate deploy` y luego `node dist/main.js`. Esta estrategia se usa porque Render no ofrece `preDeployCommand` para servicios web gratuitos. El comando de migración es incremental: no usa `migrate dev`, `db push` ni reset, y no borra datos existentes.

El frontend ejecuta `npm ci --include=dev`, `next build` y `next start`. Tanto NestJS como Next.js respetan el `PORT` asignado por Render; localmente la API conserva el puerto 3001.

## Crear el Blueprint

1. Crear una cuenta o workspace en Render y conectar la cuenta de GitHub con acceso a este repositorio.
2. En Render, elegir **New > Blueprint**, seleccionar el repositorio y la rama `main`, y confirmar que la ruta del Blueprint sea `render.yaml`.
3. Durante la creación, cargar `ADMIN_ORIGINS` con la URL HTTPS exacta del servicio web, por ejemplo `https://gestion-academia-staging-web.onrender.com`, sin barra final.
4. Cargar `NEXT_PUBLIC_API_URL` con la URL HTTPS pública completa de la API y un único sufijo `/api/v1`, por ejemplo `https://gestion-academia-staging-api.onrender.com/api/v1`.
5. Aplicar/sincronizar el Blueprint. Si las URLs definitivas asignadas por Render difieren de las previstas, corregir ambas variables en el Dashboard y desplegar nuevamente los servicios. `NEXT_PUBLIC_API_URL` debe estar presente durante el build de Next.js.
6. Confirmar en el log de la API que `prisma migrate deploy` aplicó todas las migraciones. No ejecutar un reset.
7. Abrir `https://<api>/api/v1/health` y comprobar una respuesta HTTP 200 con `{"status":"ok","service":"academy-api"}`.
8. Abrir el frontend, completar una sola vez el alta del primer administrador y probar login/logout.
9. Crear manualmente datos ficticios desde el panel: sucursal, salones, profesores, tipos de danza, clases, alumnos e inscripciones. No usar datos personales reales. No hay un seed automático en este incremento.

`DATABASE_URL` se completa mediante `fromDatabase.connectionString`; no se carga manualmente ni se copia a un `.env`. Render también proporciona `PORT` en runtime. El Blueprint fija `NODE_ENV=production`, `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAME_SITE=none`, `AUTH_SESSION_HOURS` y `BUSINESS_TIMEZONE`.

## CORS y sesiones

La API acepta una lista separada por comas en `ADMIN_ORIGINS` y habilita credenciales solamente para esos orígenes. Desarrollo usa `http://localhost:3000` por defecto. El navegador ya envía las solicitudes con `credentials: include`.

En los subdominios independientes `*.onrender.com`, la cookie necesita `SameSite=None; Secure`, configuración incluida para staging. Algunos navegadores o políticas corporativas bloquean por completo cookies de terceros aun con esos atributos. Si ocurre, la solución estable es asignar dominios personalizados HTTPS bajo el mismo sitio registrable, por ejemplo `admin.staging.ejemplo.com` y `api.staging.ejemplo.com`, y actualizar `ADMIN_ORIGINS` y `NEXT_PUBLIC_API_URL`. No se deben mover tokens a `localStorage`.

## Troubleshooting

- **La API no encuentra PostgreSQL:** comprobar que `DATABASE_URL` siga vinculada a `gestion-academia-staging-db` mediante `fromDatabase`, que ambos recursos estén disponibles y que no se haya reemplazado por una URL local.
- **Faltan tipos o Prisma Client:** verificar en el build de API que termine `npm run db:generate`; no subir `node_modules` ni `.prisma`.
- **Error CORS:** `ADMIN_ORIGINS` debe contener el origin exacto (`https`, hostname y puerto si corresponde), sin rutas ni barra final. Para varios origins, separarlos con comas.
- **El login no conserva la sesión:** comprobar HTTPS, `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAME_SITE=none`, CORS con el origin exacto y que el navegador no bloquee cookies de terceros. Para evitar esta última limitación, usar dominios personalizados del mismo sitio.
- **El frontend intenta acceder a localhost:** corregir `NEXT_PUBLIC_API_URL` y reconstruir/redeployar el frontend; las variables `NEXT_PUBLIC_*` se incorporan durante `next build`.
- **Fallan migraciones:** revisar el log del start de API y el estado de las migraciones versionadas. Corregir la migración; no usar `migrate dev`, `db push` ni reset en staging.

El Blueprint usa los planes gratuitos para minimizar costo. Los web services gratuitos pueden suspenderse por inactividad y PostgreSQL gratuito tiene límites de capacidad y vigencia definidos por Render; revisar las condiciones actuales antes de crear los recursos. Subir de plan, agregar dominios personalizados o conservar una base más allá del período gratuito puede generar cargos. Este Blueprint no crea producción ni entornos de preview.

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
