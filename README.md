# Gestión Academia

Base arquitectónica para el sistema administrativo de una academia de baile. Esta entrega contiene documentación, configuración y un esqueleto ejecutable; todavía no implementa módulos funcionales.

## Arquitectura

```text
apps/admin-web ──HTTP/JSON──> apps/api ──Prisma──> PostgreSQL
futura app alumno ───────────^   │
                                 └── módulos de dominio
```

Se adopta un **monolito modular**: una API desplegable, dividida internamente por capacidades de negocio. Es más simple de operar que microservicios, pero conserva límites que permitirían extraer módulos si el volumen lo justificara.

- `apps/api`: API REST NestJS; autenticación, validación y errores se centralizarán aquí.
- `apps/admin-web`: interfaz administrativa Next.js, sin reglas de negocio propias.
- `packages/database`: esquema y migraciones de Prisma.
- `packages/contracts`: contratos compartidos de API, sin infraestructura.
- `docs`: modelo, decisiones, ambigüedades y plan incremental.

## Stack

- Node.js 22 LTS, TypeScript estricto y npm workspaces.
- NestJS para una API modular, validable y testeable.
- Next.js para el panel administrativo.
- PostgreSQL para integridad relacional, transacciones y restricciones.
- Prisma para migraciones, acceso tipado y manejo explícito de `Decimal`.
- Vitest para pruebas unitarias. Docker Compose solamente para la base local.

## Puesta en marcha

Requiere Node.js 22+, npm 10+ y Docker con Compose.

```bash
cp .env.example .env
npm install
docker compose up -d db
npm run db:generate
npm run db:migrate
npm run dev
```

En PowerShell use `Copy-Item .env.example .env`. La API queda en `http://localhost:3001/api/v1`, el panel en `http://localhost:3000`, y `GET /api/v1/health` comprueba la API.

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Documentación

- [Modelo del dominio](docs/domain-model.md)
- [Decisiones y supuestos](docs/decisions.md)
- [Etapas](docs/roadmap.md)

## Alcance actual

El esquema incluido es deliberadamente mínimo: demuestra IDs, auditoría, precisión monetaria y separación entre alumno, profesor y usuario administrativo. El resto se incorporará por migraciones al implementar cada módulo. No están implementadas la liquidación, modalidades, pagos, cuotas, caja, asistencias ni control de acceso.

## Próxima tarea recomendada

Implementar el primer módulo vertical: migración inicial, manejo de errores, validación y CRUD de alumnos con pruebas de dominio y API.
