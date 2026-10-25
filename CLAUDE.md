# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Sistema administrativo "Carmesí" para una academia de baile: monorepo TypeScript (npm workspaces, Node 22+) y monolito modular. Las reglas obligatorias de trabajo están en [AGENTS.md](AGENTS.md); este archivo las resume y agrega lo necesario para orientarse.

## Comandos

Desde la raíz (en PowerShell, si la política bloquea `npm.ps1`, usar `npm.cmd`):

```bash
docker compose up -d db      # PostgreSQL 16 local (único uso de Docker)
npm run db:generate          # Prisma Client (necesario antes de typecheck/build)
npm run db:migrate           # prisma migrate dev (solo local)
npm run db:seed              # datos ficticios de desarrollo, idempotente (usuarios admision/administracion/direccion, contraseña DEV_SEED_PASSWORD)
npm run dev                  # API (3001, /api/v1) + admin-web (3000)

npm run lint
npm run format:check         # Prettier; `npm run format` para corregir
npm run typecheck
npm test                     # Vitest en todos los workspaces
npm run build
```

Antes de cerrar un cambio: `npm run typecheck`, `npm test` y `npm run lint` (CI además corre `format:check`, `prisma validate`, `migrate deploy` y `build`).

Tests puntuales (Vitest, sin archivo de config en `apps/api`):

```bash
npm test -w @academy/api -- src/billing/domain/payment-allocation.spec.ts
npm test -w @academy/api -- -t "nombre del test"
npm test -w @academy/admin-web -- lib/api-client.spec.ts
```

Los `*.integration.spec.ts` escriben en la base y **solo corren si `DATABASE_URL` apunta a `academy_ci` o a una base `*_test`** (guarda en `apps/api/src/database/integration-database.ts`); con otra base se omiten con un aviso. Para correrlos localmente: crear `academy_test` en el contenedor, exportar `DATABASE_URL` hacia ella y aplicar `npx prisma migrate deploy --schema packages/database/prisma/schema.prisma` (ver README). Nunca usar `migrate dev`, `db push` ni reset contra staging/producción.

## Arquitectura

```text
apps/admin-web (Next.js) --HTTP/JSON--> apps/api (NestJS, /api/v1) --Prisma--> PostgreSQL
```

- `packages/database`: `prisma/schema.prisma`, migraciones, seeds (`seed.ts` dev, `seed-staging.ts` con múltiples guardas de entorno) y cliente Prisma.
- `packages/contracts`: DTO públicos compartidos por API y web (`@academy/contracts`). No expone tipos de Prisma.
- `apps/admin-web` nunca accede a Prisma; todo pasa por `lib/api-client.ts` (cookie de sesión `HttpOnly` con `credentials: include`; `NEXT_PUBLIC_API_URL` se fija en build).

### API (`apps/api/src`)

Un directorio por módulo de negocio (`students`, `enrollments`, `offering`, `billing`, `cash`, `attendances`, `leads`, `reports`, `dashboard`, `users`, `auth`, `audit`…), con capas cuando la lógica lo justifica:

- `domain/`: reglas puras y cálculos (sin NestJS ni Prisma). Errores como `DomainError(code, message, details)` de `shared/domain/domain-error.ts`.
- `application/`: servicios de casos de uso e interfaces de repositorio (`*.repository.ts`).
- `infrastructure/`: implementaciones Prisma (`prisma-*.repository.ts`).
- `presentation/`: controllers; la validación manual de entrada usa helpers de `shared/presentation/request-validation.ts` y `domain-exception.filter.ts` traduce `DomainError` a HTTP.
- `testing/`: repositorios en memoria para tests de servicios.

Autorización: guards globales de sesión y permisos en `auth/presentation`. Cada endpoint declara capacidades con `@Permissions('payments:collect', …)`; la matriz rol→permisos (Admisión `RECEPTION` ⊂ Administración `MANAGER` ⊂ Dirección `ADMINISTRATOR`) vive en `auth/domain/permissions.ts`. La API es la autoridad; la web solo oculta. Rutas públicas con `@Public()`. Los `*.auth-boundary.spec.ts` verifican estos límites.

Concurrencia: operaciones financieras e inscripciones usan transacciones serializables con reintento compartido (`database/serializable-retry.ts`); los pagos se serializan por alumno.

### Flujo financiero (lo más entrelazado)

Tarifa → cuota mensual (`MonthlyCharge`, con snapshot del importe y de ajustes/becas) → pago con uno o más medios (`tenders`) que el servidor imputa a la deuda más antigua → cada tender genera un movimiento de Caja en el turno abierto del usuario (sin turno abierto no se cobra). Anulaciones, reversas y correcciones son append-only: nunca se reescriben importes, imputaciones ni cierres de caja. El recargo por vencimiento se materializa de forma idempotente al cobrar.

### admin-web (`apps/admin-web`)

Next.js App Router: rutas en `app/<sección>`, componentes en `components/` (primitivas en `components/ui`), lógica pura testeable en `lib/`. Estilos en CSS plano con tokens en `app/tokens.css` (temas claro/oscuro vía `data-theme`), sin framework CSS. Para superficies nuevas se aprueba primero una propuesta visual (`.impeccable/config.json`: `buildPath: comp`); ver `PRODUCT.md` para el contexto de marca.

## Reglas clave (de AGENTS.md)

- Antes de implementar: leer `docs/domain-model.md`, `docs/decisions.md` y `docs/roadmap.md`, y registrar toda decisión o supuesto nuevo en `docs/decisions.md`. Si la regla figura en "Reglas ambiguas: no implementar" de `docs/decisions.md`, detenerse y pedir definición.
- Incrementos verticales pequeños; no implementar módulos futuros sin requisitos confirmados.
- Código en inglés; textos de negocio, mensajes de error y documentación en español. Archivos `kebab-case`.
- Dinero: `Decimal` en base, string decimal en la API, nunca `float`. Instantes en UTC; zona de negocio `America/Buenos_Aires` (`BUSINESS_TIMEZONE`). DNI es texto normalizado.
- Todo cambio de esquema requiere una migración nueva; nunca editar migraciones aplicadas.
- No crear una entidad genérica "persona" para alumnos, profesores y usuarios.
- Contratos públicos versionados bajo `/api/v1`; nuevas acciones deben mapearse a permisos existentes o ampliar explícitamente la matriz.
- Variables nuevas de entorno van a `.env.example` sin secretos.
- Line endings LF (`.gitattributes`); los scripts sueltos de `scripts/` quedan fuera del lint.


# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" ? "Write tests for invalid inputs, then make them pass"
- "Fix the bug" ? "Write a test that reproduces it, then make it pass"
- "Refactor X" ? "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] ? verify: [check]
2. [Step] ? verify: [check]
3. [Step] ? verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

