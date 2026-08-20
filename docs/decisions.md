# Decisiones y supuestos

## Decisiones iniciales

1. **Monolito modular:** reduce complejidad inicial. Los módulos se comunican mediante interfaces/casos de uso.
2. **REST JSON versionada:** suficiente para panel y futura app; OpenAPI llegará con los endpoints de negocio.
3. **PostgreSQL y Prisma:** el dominio necesita transacciones, relaciones y decimales exactos.
4. **UUID:** no expone conteos y facilita múltiples clientes.
5. **Desactivación en vez de borrado:** los registros financieros no se eliminan; las correcciones tendrán trazabilidad.
6. **Clase y horarios separados:** una clase puede tener varios días y permite controlar conflictos.
7. **Inscripción con ciclo de vida:** une alumno y clase con vigencia/estado; no se embebe en alumno.
8. **Autenticación administrativa separada:** existir como alumno o profesor no concede acceso.
9. **Importes con moneda:** decimal fijo y código ISO, inicialmente `ARS`.

## Supuestos revisables

- Idioma español, moneda ARS y zona `America/Buenos_Aires`.
- Una clase tiene un profesor responsable; profesores adicionales deben confirmarse.
- DNI único dentro de cada tipo de actor, no necesariamente global.
- El cupo aplica a inscripciones activas.

## Decisiones del módulo de alumnos

10. **DNI normalizado:** se persiste sin puntos, guiones ni espacios, conservando solamente dígitos. Es obligatorio y único entre alumnos.
11. **Baja lógica:** `DELETE /students/:id` cambia el estado a `INACTIVE`; no elimina datos. Un alumno puede reactivarse mediante actualización.
12. **Datos mínimos:** DNI, nombre y apellido son obligatorios. La fecha de nacimiento es opcional, pero no puede estar en el futuro. Teléfono, correo y domicilio son opcionales.
13. **Actualización parcial:** el alta usa `POST`; las modificaciones usan `PATCH`. Los valores de texto se recortan y los opcionales vacíos se guardan como nulos.

## Decisiones de autenticación administrativa

14. **Identidad separada:** solamente `AdminUser` puede iniciar sesión en el panel; alumnos y profesores no adquieren acceso por existir en el sistema.
15. **Primer administrador:** una instalación sin usuarios habilita una única configuración inicial desde el panel. El primer usuario recibe el rol `ADMINISTRATOR`; luego el endpoint queda deshabilitado.
16. **Contraseñas:** se almacenan con `scrypt`, sal aleatoria y parámetros incluidos en el hash. La longitud mínima inicial es 12 caracteres.
17. **Sesiones opacas:** el navegador recibe una cookie `HttpOnly`, `SameSite=Lax`; la base conserva solamente SHA-256 del token. Las sesiones vencen a las 12 horas y se invalidan al cerrar sesión.
18. **Roles sin permisos inventados:** se reservan `ADMINISTRATOR`, `RECEPTION` y `MANAGER`, pero en esta etapa todo usuario administrativo activo tiene el mismo acceso. La matriz concreta continúa pendiente.

## Decisiones de Alumnos v1

19. **Listado paginado:** `GET /students` devuelve una envoltura con `items`, `total`, `page` y `pageSize`. La página inicial es 1, el tamaño predeterminado es 25 y el máximo permitido es 100.
20. **Búsqueda simple en base:** cada término de texto debe coincidir parcialmente con nombre o apellido; esto permite buscar nombre completo sin incorporar un motor de búsqueda prematuro. DNI se busca normalizado y teléfono por coincidencia parcial.
21. **Edad derivada:** la edad se calcula en la interfaz a partir de `birthDate`; no se persiste ni forma parte del dominio.
22. **Frontend por módulo:** autenticación y acceso HTTP son transversales; `/students`, `/students/new` y `/students/:id` concentran listado, alta y ficha/edición respectivamente dentro de un shell administrativo reutilizable.

## Reglas ambiguas: no implementar

- Fórmula docente: base 50 %, umbral del alumno 11, alcance del 70 %, redondeo, ausencias y devoluciones.
- Significado y facturación de “Formación” y “Solo salón / alquiler”.
- Relación entre frecuencia semanal, clases elegidas y tarifa/plan.
- Prorrateos, mora, recargos, becas y combinación/prioridad de descuentos.
- Imputación de pagos parciales, saldo a favor, anulaciones y devoluciones.
- Apertura/cierre/arqueo de caja y cajas por sucursal o usuario.
- Recuperos, feriados, reemplazos y asistencia fuera de inscripción.
- Excepciones de solapamiento, intervalos contiguos y clases canceladas.
- Tolerancias, pausas y horas docentes liquidables.
- Matriz concreta de permisos.
- Método de acceso y conducta ante deuda o vencimiento.
