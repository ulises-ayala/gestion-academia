# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

El panel interno de Carmesí lo usan los equipos de Admisión, Administración y Dirección de una academia de baile. La prioridad operativa es que recepción pueda resolver con rapidez las tareas diarias sin perder la información ni el contexto de cada alumno.

## Product Purpose

Carmesí centraliza la gestión académica y administrativa de la academia: alumnos, oferta académica, inscripciones, asistencias, cuotas, cobros y caja. Busca que el equipo opere con información vigente, trazable y accesible según su función.

## Positioning

Un único panel operativo para la academia que combina la gestión cotidiana de recepción con reglas de negocio, permisos y trazabilidad financiera aplicados por la API.

## Operating Context

La operación ocurre durante la atención diaria de la academia. Admisión registra y consulta alumnos, inscripciones, asistencias y potenciales alumnos; Administración y Dirección también gestionan cuotas, pagos, caja, reportes y las funciones que autorizan sus capacidades.

## Capabilities and Constraints

- El panel Next.js consume exclusivamente la API REST versionada bajo `/api/v1`; no accede a Prisma ni a la base de datos.
- La API aplica las capacidades por rol; la interfaz respeta esa visibilidad pero no la sustituye.
- Los importes monetarios se manejan como decimales exactos en ARS y las fechas operativas usan `America/Buenos_Aires`.
- Pagos, cuotas, caja y auditoría conservan su historia; no se eliminan ni se reescriben registros financieros.
- El producto ya incluye alumnos, oferta académica, inscripciones, tarifas y cuotas, pagos, caja, asistencias, ficha integral, potenciales alumnos, dashboard, reportes y seguimiento de alumnos.

## Brand Commitments

La interfaz administrativa usa una base sobria de superficies neutras y acento vino/carmesí. La marca debe estar presente sin perjudicar la legibilidad ni el significado semántico de estados de éxito, advertencia y peligro.

## Evidence on Hand

- Reglas de negocio y modelo: `docs/domain-model.md`.
- Decisiones confirmadas: `docs/decisions.md`.
- Alcance incremental: `docs/roadmap.md`.
- El repositorio incluye datos ficticios locales para pruebas y desarrollo. No se deben presentar como datos o testimonios reales.

## Product Principles

- Resolver las tareas frecuentes de recepción con rapidez y claridad.
- Mantener la autoridad de las reglas de negocio y permisos en la API.
- Conservar la historia académica y financiera sin sobrescribirla.
- Mostrar información operativa accionable según las capacidades de cada rol.
- Evitar funcionalidades o reglas de negocio no confirmadas.

## Accessibility & Inclusion

Las pantallas deben conservar controles legibles, foco visible, contraste suficiente y comportamiento responsive para permitir el trabajo administrativo en distintos tamaños de pantalla.
