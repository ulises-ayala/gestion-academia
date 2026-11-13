# Carmesí · Gestión de academia de danza

Sistema administrativo completo para una academia de danza: alumnos, clases, inscripciones, cuotas, cobros, caja, asistencias, liquidación de profesores y reportes. Está **en uso diario en una academia real** desde octubre de 2026, donde reemplazó al sistema anterior (ControlFit) y a las planillas que lo complementaban.

Es un monorepo TypeScript con una API NestJS, un panel Next.js y PostgreSQL. Lo desarrollamos [Ulises Ayala](https://github.com/ulises-ayala) y Mariano Elordi, trabajando directamente con la dueña del producto de la academia: cada regla de negocio que definió está registrada en [docs/decisions.md](docs/decisions.md).

|                           |                                                                         |
| ------------------------- | ----------------------------------------------------------------------- |
| **Stack**                 | TypeScript · NestJS 11 · Next.js 15 · React 19 · Prisma 6 · PostgreSQL  |
| **Tamaño**                | ~58.000 líneas de TypeScript · cerca de 150 endpoints · 43 migraciones  |
| **Tests**                 | Más de 800 (unitarios, de componentes, de migraciones y de integración) |
| **Decisiones de negocio** | Más de 260, numeradas y versionadas con el código                       |

## Qué resuelve

**Alumnos y oferta académica**

- Ficha integral del alumno: datos, inscripciones, cuotas, pagos y asistencias en un solo lugar.
- Clases con varios horarios, salones, sucursales y profesores; detecta choques de salón y de profesor.
- Inscripciones con cupo controlado de forma transaccional, modalidades (tarifa por alumno) y día de pago acordado.
- Potenciales alumnos con seguimiento y clase de prueba gratis, una por clase.

**Cuotas y cobros**

- Cuotas mensuales con recargo por vencimiento.
- **Becas y descuentos** recurrentes por inscripción, con vigencia, renovación y reversa; cada cuota guarda una foto de los que se le aplicaron.
- Cobro con uno o varios medios (efectivo, Mercado Pago, transferencia, tarjeta), pagos parciales y recargo por tarjeta según débito o crédito.
- El sistema imputa a la deuda más antigua; Administración puede elegir las cuotas o reimputar un pago ya registrado.
- Saldo a favor, devoluciones, corrección y anulación de pagos, siempre dejando historia.
- Comprobante y avisos de deuda por WhatsApp, con el texto ya armado.

**Caja**

- Turnos de caja por usuario: sin turno abierto no se cobra, y cada medio de pago genera su movimiento.
- Cierre de turno con lo esperado, lo declarado y la diferencia por medio; las correcciones posteriores no reescriben el cierre original.
- Cierres semanales y mensuales guardados como una foto, con PDF.

**Gestión**

- Liquidación de profesores por criterio de caja, con repartos por clase y vigencia mensual.
- **Dashboard** de inicio con dos vistas: "Hoy" (la prioridad del momento, pendientes, deuda y cobrado del día) y "Este mes" (altas, bajas, ocupación por clase, cobranza y recaudación).
- Reportes por período con comparación contra el período anterior, exportación a CSV y PDF.
- Mensajes de WhatsApp predeterminados por situación (cuota vencida, ausencias, bienvenida, cumpleaños…), con registro de a quién se le escribió.
- **Registro de auditoría** (audit log) consultable: quién hizo qué y cuándo, con el antes y el después de cada cambio sensible.
- Tres niveles de acceso: Admisión, Administración y Dirección.

**Migración de datos históricos**

- Los alumnos, inscripciones, tarifas y cobros del sistema anterior (ControlFit) se migraron con scripts propios: análisis previo, simulación con reporte e importación idempotente. Las reglas de cada caso dudoso quedaron como decisiones numeradas.

## Arquitectura

![Diagrama de arquitectura: el panel Next.js consume la API NestJS, que accede con Prisma a PostgreSQL en Neon; GitHub Actions corre la integración continua y despliega en Render](docs/arquitectura.svg)

Monolito modular en un monorepo de npm workspaces:

| Paquete              | Qué contiene                                                                     |
| -------------------- | -------------------------------------------------------------------------------- |
| `apps/api`           | API REST versionada bajo `/api/v1`. Un directorio por módulo de negocio.         |
| `apps/admin-web`     | Panel administrativo (App Router). Nunca accede a la base: todo pasa por la API. |
| `packages/database`  | Esquema Prisma, migraciones escritas a mano y seeds.                             |
| `packages/contracts` | DTO públicos compartidos entre API y panel; no expone tipos de Prisma.           |
| `docs`               | Modelo de dominio, decisiones, roadmap, instructivo y guías de operación.        |

Cada módulo de la API (`students`, `enrollments`, `billing`, `cash`, `attendances`, `settlements`, `reports`, `messages`…) se organiza en capas cuando la lógica lo justifica:

- `domain/`: reglas puras y cálculos, sin NestJS ni Prisma.
- `application/`: casos de uso e interfaces de repositorio.
- `infrastructure/`: implementaciones con Prisma.
- `presentation/`: controllers y validación de entrada.

## Decisiones técnicas que vale la pena mirar

- **Finanzas append-only.** Anulaciones, reversas, reimputaciones y correcciones agregan registros; nunca se reescriben importes, imputaciones ni cierres de caja. Un cierre guardado se puede comparar contra el estado actual para ver qué cambió después.
- **Concurrencia en serio.** Los cobros y las inscripciones corren en transacciones serializables con reintento, y los pagos se serializan por alumno con un bloqueo consultivo de PostgreSQL, para que dos cajas no imputen la misma deuda a la vez.
- **Dinero sin `float`.** `Decimal` en la base y en los cálculos, texto decimal en la API.
- **La API es la autoridad.** Cada endpoint declara los permisos que exige; el panel solo oculta lo que el rol no puede hacer. Tests de límites de autorización verifican la matriz.
- **Fechas de negocio.** Los instantes se guardan en UTC y el día operativo se calcula en `America/Buenos_Aires`, incluido el criterio de caja de la liquidación.
- **Migraciones escritas a mano y probadas.** Cada cambio de esquema tiene su migración y un test que verifica lo que hace; nunca se edita una ya aplicada.
- **Tests de integración con guarda.** Solo corren contra una base llamada `academy_ci` o terminada en `_test`, para que nadie los ejecute por error contra producción.
- **Diseño sin framework CSS.** CSS plano con tokens, temas claro y oscuro, y tablas que se vuelven tarjetas en el celular.

## Stack

- **Lenguaje y herramientas:** TypeScript 5.9 estricto, Node.js 22+, npm workspaces, ESLint 9, Prettier 3.
- **API:** NestJS 11, Prisma 6, PostgreSQL 16, PDFKit para los PDF.
- **Panel:** Next.js 15 (App Router), React 19, CSS con tokens propios, íconos Lucide.
- **Tests:** Vitest 3.
- **Infraestructura:** Render (API y panel), Neon (PostgreSQL), GitHub Actions (CI y respaldo cifrado de la base cada 3 días) y Docker Compose.

## Puesta en marcha

Requiere Node.js 22+, npm 10+ y Docker.

```bash
cp .env.example .env
npm install
docker compose up -d db
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

En PowerShell, usar `Copy-Item .env.example .env`; si la política de ejecución bloquea `npm.ps1`, usar `npm.cmd`.

- Panel: `http://localhost:3000`
- API: `http://localhost:3001/api/v1`
- Salud: `GET http://localhost:3001/api/v1/health`

`npm run db:seed` carga datos **ficticios** y crea tres usuarios, uno por nivel de acceso: `admision`, `administracion` y `direccion`. La contraseña es la de `DEV_SEED_PASSWORD` en `.env`. El seed es idempotente y solo corre en desarrollo contra una base local llamada `academy`.

Sin seed, el primer ingreso al panel pide crear el usuario administrador inicial.

## Calidad

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

La integración continua ([.github/workflows/ci.yml](.github/workflows/ci.yml)) corre todo eso en cada push y pull request a `main`, contra un PostgreSQL efímero al que le aplica todas las migraciones desde cero.

### Tests de integración

Crean usuarios, alumnos, cuotas y pagos de prueba, así que solo corren contra una base dedicada: `academy_ci` en CI o cualquier base cuyo nombre termine en `_test`. Con otra base se omiten y se muestra un aviso.

Para correrlos localmente con el PostgreSQL de Docker (PowerShell):

```powershell
docker compose up -d db
docker compose exec db createdb -U academy academy_test
$env:DATABASE_URL = "postgresql://academy:academy@localhost:5432/academy_test?schema=public"
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
npm test
Remove-Item Env:DATABASE_URL
```

## Despliegue

- **Render:** la API y el panel se definen en [`render.yaml`](render.yaml) y se despliegan solos desde `main` cuando pasa la integración continua. Al arrancar, la API aplica las migraciones pendientes (`prisma migrate deploy`, incremental y sin reset). Ver [docs/staging-render.md](docs/staging-render.md).
- **Neon:** la base de datos de la academia es PostgreSQL en Neon. Un workflow de GitHub Actions la respalda cifrada cada 3 días. Ver [docs/backups.md](docs/backups.md).
- **VPS:** también está documentado el despliegue con Docker Compose en un servidor propio. Ver [docs/deploy-vps.md](docs/deploy-vps.md).

## Roles y permisos

Los niveles son acumulativos: Administración hereda lo de Admisión y Dirección hereda lo de Administración. La matriz completa está en [`apps/api/src/auth/domain/permissions.ts`](apps/api/src/auth/domain/permissions.ts).

| Capacidad                                            | Admisión | Administración | Dirección |
| ---------------------------------------------------- | :------: | :------------: | :-------: |
| Alumnos, inscripciones, potenciales y asistencias    |    ✅    |       ✅       |    ✅     |
| Cobrar y abrir o cerrar su turno de caja             |    ✅    |       ✅       |    ✅     |
| Generar cuotas y enviar mensajes de WhatsApp         |    ✅    |       ✅       |    ✅     |
| Oferta académica, tarifas y becas                    |    —     |       ✅       |    ✅     |
| Corregir, reimputar y anular pagos                   |    —     |       ✅       |    ✅     |
| Controlar la caja, cierres y reportes                |    —     |       ✅       |    ✅     |
| Preparar la liquidación de profesores                |    —     |       ✅       |    ✅     |
| Devolver saldo a favor                               |    —     |       —        |    ✅     |
| Cerrar la liquidación, usuarios y reportes completos |    —     |       —        |    ✅     |

## Documentación

- [Modelo de dominio](docs/domain-model.md)
- [Decisiones de negocio](docs/decisions.md)
- [Roadmap](docs/roadmap.md)
- [Instructivo para la academia](docs/instructivo/instructivo.md), organizado por nivel de acceso
- [Staging en Render y seed de staging](docs/staging-render.md)
- [Despliegue en VPS](docs/deploy-vps.md)
- [Respaldos de la base](docs/backups.md)
- [Importación histórica desde ControlFit](docs/importacion-controlfit.md)

## Datos y seguridad

- El repositorio no contiene datos reales de alumnos: planillas, exportaciones y respaldos están fuera del control de versiones.
- Las credenciales viven solo en el proveedor de hosting y en los secretos de GitHub Actions; `.env.example` no incluye secretos.
- Las contraseñas se derivan con `scrypt`, las sesiones son opacas, se guardan solo como hash y viajan en una cookie `HttpOnly`.
