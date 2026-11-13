# Migración desde ControlFit

Scripts que se usaron para pasar a Carmesí los datos del sistema anterior de la academia (ControlFit) y de las planillas que lo complementaban. Ya se corrieron: quedan como registro de cómo se hizo la migración y por si hiciera falta repetir un paso.

Las reglas de cada caso dudoso están en [docs/decisions.md](../../docs/decisions.md) (decisiones 147–167 y 201), y la importación de cobros se explica en [docs/importacion-controlfit.md](../../docs/importacion-controlfit.md).

## Cómo funcionan

- Se corren **desde la raíz del repositorio**, con `node scripts/migracion-controlfit/<script>.mjs`.
- Leen las planillas de `scripts/data/` y escriben sus reportes en `exports/`. Ninguna de las dos carpetas se versiona: tienen datos reales de alumnos.
- Los que escriben en la base primero **simulan** y muestran un reporte; solo aplican con `--apply`, y algunos exigen además `CONTROLFIT_IMPORT_CONFIRM` con el nombre de la base.

## Qué hace cada uno

**Análisis (solo lectura, generan reportes)**

| Script                                   | Qué revisa                                                           |
| ---------------------------------------- | -------------------------------------------------------------------- |
| `analyze-historical-tariffs.mjs`         | Tarifas que surgen del historial normalizado                         |
| `analyze-tariffs-coverage-gaps.mjs`      | Meses sin tarifa para alguna clase                                   |
| `analyze-no-tariff-classes.mjs`          | Clases con cobros pero sin tarifa                                    |
| `analyze-historical-monthly-charges.mjs` | Cuotas históricas a reconstruir                                      |
| `analyze-class-mapping-conflicts.mjs`    | Clases de ControlFit que no corresponden a una sola clase de Carmesí |
| `analyze-grupo-c-status-conflicts.mjs`   | Un caso puntual de estados contradictorios de un grupo               |
| `analyze-june-2026-payments.mjs`         | Movimientos de caja de junio a octubre de 2026                       |
| `compare-historical-tariffs-with-db.mjs` | Diferencias entre las tarifas históricas y la base                   |
| `reconcile-payments.mjs`                 | Conciliación de pagos entre ControlFit y la base                     |

**Planes y armado de datos (solo lectura)**

| Script                               | Qué arma                                     |
| ------------------------------------ | -------------------------------------------- |
| `build-final-historical-tariffs.mjs` | Las tarifas históricas listas para importar  |
| `build-missing-class-tariffs.mjs`    | Las tarifas que faltaban para algunas clases |
| `plan-class-mapping-migration.mjs`   | El plan para unificar clases mal asociadas   |
| `plan-no-tariff-resolution.mjs`      | El plan para resolver clases sin tarifa      |

**Importación y correcciones (escriben solo con `--apply`)**

| Script                               | Qué hace                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------- |
| `import-students.mjs`                | Alumnos desde la lista de socios                                           |
| `import-historical-students.mjs`     | Alumnos del historial                                                      |
| `import-enrollment.mjs`              | Inscripciones desde la lista de socios                                     |
| `import-historical-enrollments.mjs`  | Inscripciones del historial                                                |
| `import-historical-tariffs.mjs`      | Tarifas históricas                                                         |
| `sync-historical-tariffs.mjs`        | Ajuste de tarifas contra la base                                           |
| `migrate-controlfit-history.mjs`     | Historial de inscripciones de ControlFit                                   |
| `import-controlfit-payments.mjs`     | Cobros de cuota (usa `lib/controlfit-payment-import.mjs`, que tiene tests) |
| `sync-controlfit-october-2026.mjs`   | Sincronización de octubre de 2026, por fases                               |
| `close-legacy-ended-enrollments.mjs` | Fecha de fin para inscripciones terminadas que no la tenían                |

**Exportaciones y utilidades**

| Archivo                                                               | Qué hace                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `export-students.mjs`, `export-classes.mjs`, `export-enrollments.mjs` | Exportan datos actuales para cruzarlos con las planillas                  |
| `controlfit-class-mapping.json`                                       | Equivalencias entre las actividades de ControlFit y las clases de Carmesí |
| `repair-encoding.py`                                                  | Arregló una vez la codificación de un respaldo SQL                        |
