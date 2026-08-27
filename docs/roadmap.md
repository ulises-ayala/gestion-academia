# Plan incremental

1. **Base y Alumnos v1 (terminado):** migraciones iniciales, errores, validación, autenticación, contratos públicos y CRUD de alumnos con búsqueda, filtros, paginación, ficha y baja lógica.
2. **Oferta Académica v1 (terminado):** profesores, danzas, sucursales, salones, clases, horarios y conflictos de salón/profesor.
3. **Inscripciones v1 (terminado):** `Enrollment`, altas/finalización, historia, cupos y fichas de alumno/clase.
4. **Tarifas y cuotas v1 (terminado):** tarifa simple por clase, cuota mensual manual por inscripción, vencimiento 1–10 y snapshot monetario; prorrateos, descuentos y promociones siguen pendientes.
5. **Usuarios y permisos v1 (terminado):** autorización por capacidad, navegación restringida y administración de cuentas según Admisión, Administración y Dirección.
6. **Pagos y caja:** parciales, imputaciones, medios y cierres según reglas confirmadas.
7. **Asistencias de alumnos v1 (terminado):** roster por vigencia, registro/corrección e historial. Asistencia docente, reglas especiales y acceso quedan pendientes.
8. **Liquidación:** motor configurable después de validar fórmula y modalidades.
9. **Reportes y robustez:** estadísticas, observabilidad, backups y seguridad.
10. **Canal alumno:** nueva interfaz sobre la misma API e integraciones aisladas.

Cada etapa entrega migraciones, casos de uso, endpoints documentados, UI mínima y pruebas críticas.

La matriz inicial está confirmada. Toda nueva acción de pagos, caja, inventario, reportes o liquidaciones debe asociarse a uno de los permisos existentes o registrar explícitamente una ampliación de la matriz.
