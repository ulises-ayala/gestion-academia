# Guía para agentes

## Objetivo

Construir el sistema en incrementos verticales pequeños. No implementar reglas ambiguas ni módulos futuros sin requisitos confirmados.

## Arquitectura obligatoria

- Mantener `admin-web -> API -> base de datos`; la UI nunca accede directamente a Prisma.
- Organizar la API por módulo de negocio. Separar `domain`, `application`, `infrastructure` y `presentation` cuando exista lógica que lo justifique.
- El dominio no importa NestJS, Prisma ni componentes web.
- No crear una entidad genérica para alumnos, profesores y administrativos. Se admiten value objects compartidos, no identidades o ciclos de vida compartidos por accidente.
- Versionar contratos públicos bajo `/api/v1`.

## Convenciones

- TypeScript estricto; código en inglés y textos de negocio/documentación en español.
- Archivos `kebab-case`; clases/tipos `PascalCase`; variables/funciones `camelCase`.
- Dinero: `Decimal` en base y string decimal en la API. Nunca `float`.
- Persistir instantes en UTC; zona configurable (inicialmente `America/Buenos_Aires`).
- DNI es texto normalizado, no número.
- Toda modificación de esquema requiere migración; no reescribir migraciones aplicadas.
- Guardar solamente hashes de contraseña; nunca registrar secretos, tokens ni contraseñas.
- Configuración por entorno; actualizar `.env.example` sin secretos.
- Errores de dominio tipados y traducción a HTTP en presentación.

## Calidad

- Probar primero invariantes y cálculos; sumar integración para persistencia y endpoints críticos.
- Ejecutar `npm run typecheck`, `npm test` y lint antes de cerrar un cambio.
- Evitar abstracciones prematuras, duplicación y archivos gigantes.
- Preservar historia: no sobrescribir tarifas vigentes ni importes calculados de cuotas.

## Antes de implementar

1. Leer `docs/domain-model.md`, `docs/decisions.md` y `docs/roadmap.md`.
2. Registrar una decisión o suposición nueva en `docs/decisions.md`.
3. Si una regla figura como ambigua, detener esa parte y pedir definición.
