# Plan incremental

1. **Base y Alumnos v1 (terminado):** migraciones iniciales, errores, validación, autenticación, contratos públicos y CRUD de alumnos con búsqueda, filtros, paginación, ficha y baja lógica.
2. **Oferta Académica v1 (terminado):** profesores, danzas, sucursales, salones, clases, horarios y conflictos de salón/profesor.
3. **Inscripciones v1 (terminado):** `Enrollment`, altas/finalización, historia, cupos y fichas de alumno/clase.
4. **Tarifas y cuotas v1 (terminado):** tarifa simple por clase, cuota mensual manual por inscripción, vencimiento 1–10 y snapshot monetario; prorrateos, descuentos y promociones siguen pendientes.
5. **Usuarios y permisos v1 (terminado):** autorización por capacidad, navegación restringida y administración de cuentas según Admisión, Administración y Dirección.
6. **Pagos v1 (terminado):** cobro de cuotas completas, imputaciones, efectivo/Mercado Pago/tarjeta, historial y anulación. No existen pagos parciales.
7. **Caja (pendiente):** movimientos, arqueos y eventual apertura/cierre después de confirmar sus reglas.
8. **Asistencias de alumnos v1 (terminado):** roster por vigencia, registro/corrección e historial. Asistencia docente, reglas especiales y acceso quedan pendientes.
9. **Liquidación:** motor configurable después de validar fórmula y modalidades.
10. **Reportes y robustez:** estadísticas, observabilidad, backups y seguridad.
11. **Canal alumno:** nueva interfaz sobre la misma API e integraciones aisladas.
12. **Ficha integral del alumno v1 (terminado):** vista administrativa central con inscripciones, estado de cuenta, pagos y asistencias recientes; mantiene las reglas y permisos de cada recurso.
13. **Potenciales alumnos v1 (terminado):** registro manual de consultas, seguimiento, duplicados preventivos y etapas comerciales sin conversión automática a alumno.
14. **Dashboard operativo v1 (terminado):** inicio agregado y responsive con agenda diaria, indicadores, alertas, seguimientos y actividad reciente según permisos.

Cada etapa entrega migraciones, casos de uso, endpoints documentados, UI mínima y pruebas críticas.

La matriz inicial está confirmada. Toda nueva acción de pagos, caja, inventario, reportes o liquidaciones debe asociarse a uno de los permisos existentes o registrar explícitamente una ampliación de la matriz.

# Base transversal de auditoría

Auditoría y trazabilidad v1 establece el historial append-only y atómico requerido antes de incorporar Caja, correcciones financieras, inventario y liquidaciones. Esos módulos continúan fuera del alcance actual.
