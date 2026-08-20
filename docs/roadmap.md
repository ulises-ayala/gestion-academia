# Plan incremental

1. **Base y Alumnos v1 (terminado):** migraciones iniciales, errores, validación, autenticación, contratos públicos y CRUD de alumnos con búsqueda, filtros, paginación, ficha y baja lógica.
2. **Oferta Académica v1 (terminado):** profesores, danzas, sucursales, salones, clases, horarios y conflictos de salón/profesor.
3. **Inscripciones v1 (siguiente):** `Enrollment`, altas/bajas, cupos y ficha del alumno.
4. **Tarifas y cuotas:** relevar planes, versionado, descuentos y generación.
5. **Pagos y caja:** parciales, imputaciones, medios y cierres según reglas confirmadas.
6. **Asistencias y acceso:** alumnos/docentes, búsqueda y auditoría; sin hardware.
7. **Liquidación:** motor configurable después de validar fórmula y modalidades.
8. **Reportes y robustez:** estadísticas, permisos, observabilidad, backups y seguridad.
9. **Canal alumno:** nueva interfaz sobre la misma API e integraciones aisladas.

Cada etapa entrega migraciones, casos de uso, endpoints documentados, UI mínima y pruebas críticas.

Antes de implementar administración de usuarios o módulos sensibles (tarifas, pagos, caja y liquidaciones), debe confirmarse una matriz de permisos por rol. Hasta entonces, todos los usuarios administrativos activos conservan igual acceso a Alumnos v1.
