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

## Decisiones de Oferta Académica v1

23. **Profesor responsable único:** cada clase referencia un `Teacher`. Una futura ampliación a colaboradores podrá agregar una relación sin eliminar esta responsabilidad principal.
24. **Horas locales:** `ClassSchedule.startTime/endTime` usan PostgreSQL `TIME(0)` y la API usa `HH:mm`; no representan instantes UTC.
25. **Sucursal derivada:** un horario referencia solamente `Room`; `Branch` se obtiene a través del salón y no se duplica.
26. **Intervalos semiabiertos:** existe conflicto cuando `inicioExistente < finNuevo` y `finExistente > inicioNuevo`. Por ello 20:00–21:00 y 21:00–22:00 son contiguos válidos.
27. **Conflictos transaccionales:** alta y edición de clase validan salón y profesor dentro de una transacción serializable.
28. **Historial de horarios:** al reemplazar horarios se desactivan los anteriores y se crean nuevos; no se reescribe ni elimina el historial.
29. **Desactivación sin cascadas:** se rechaza desactivar un profesor o danza con clases activas, una sucursal con salones activos o un salón usado por clases activas. Desactivar una clase conserva sus horarios.
30. **Danzas equivalentes:** `DanceType` persiste un nombre normalizado con restricción única para impedir variantes triviales por mayúsculas o espacios.

## Decisiones de Inscripciones v1

31. **Vigencia persistente:** una inscripción permanece activa hasta que administración la finaliza explícitamente. Es revisable si el negocio confirma reinscripciones mensuales.
32. **Unicidad activa:** PostgreSQL refuerza una sola inscripción `ACTIVE` por alumno/clase mediante un índice único parcial; períodos `ENDED` no impiden reinscribir.
33. **Cupo transaccional:** `AcademyClass.capacity` es la única autoridad en esta versión. El alta toma un advisory lock transaccional por clase, usa aislamiento serializable y reintenta hasta tres veces conflictos de serialización.
34. **Finalización explícita:** finalizar guarda `ENDED` y `endDate >= startDate`; nunca elimina ni sobrescribe períodos anteriores.
35. **Desactivación conservadora:** alumno o clase con inscripciones activas no pueden desactivarse. No se finalizan inscripciones por cascada.
36. **Cupo mínimo:** `AcademyClass.capacity` nunca puede ser inferior al número de inscripciones `ACTIVE`. Al modificar el cupo, la API toma el mismo advisory lock por clase que el alta de inscripciones y consulta la ocupación real dentro de la transacción.

## Decisiones de integración continua

37. **CI aislada y reproducible:** GitHub Actions valida cada `push` y `pull_request` sobre `main` con Node.js 22, dependencias instaladas mediante `npm ci` y una instancia efímera de PostgreSQL 16. La base usa credenciales exclusivas y no secretas de CI; el esquema se reconstruye aplicando las migraciones versionadas con `prisma migrate deploy`.

## Decisiones de staging

38. **Staging declarativo en Render:** un Blueprint crea dos servicios web Node y una base PostgreSQL exclusivos de staging desde `main`. Los comandos se ejecutan desde la raíz para preservar npm workspaces y los despliegues automáticos esperan que pase CI.
39. **Migraciones sin pre-deploy pago:** para admitir servicios web gratuitos, el arranque de la API ejecuta `prisma migrate deploy` antes del servidor. El comando es idempotente, no reinicia la base y detiene el despliegue si una migración falla.
40. **Cookie configurable por entorno:** desarrollo conserva `SameSite=Lax` sin `Secure`; staging usa `SameSite=None` y `Secure=true` para los servicios HTTPS separados. CORS mantiene una lista explícita de orígenes y credenciales habilitadas.

## Decisiones de Tarifas y Cuotas v1

41. **Cuota por inscripción persistente:** cada `MonthlyCharge` referencia una `Enrollment` existente y conserva `studentId`. El período mensual no crea una nueva inscripción; dos inscripciones pueden producir dos cuotas para el mismo alumno y mes.
42. **Período mensual canónico:** la API recibe `AAAA-MM` y la base lo guarda como el primer día del mes. Una restricción única sobre `enrollmentId + period` impide duplicados incluso ante requests simultáneas.
43. **Snapshot monetario:** al generar se copian monto base, descuento cero y monto final desde la tarifa. Los importes usan `Decimal(12,2)` y no se recalculan al editar o desactivar la tarifa.
44. **Generación manual acotada:** solamente inscripciones activas y tarifas activas/vigentes admiten una cuota nueva. Administración elige explícitamente período y vencimiento; el vencimiento debe caer entre los días 1 y 10 del mismo mes.
45. **Estados preparados, transiciones diferidas:** toda cuota v1 nace `PENDING`. `PAID` y `VOID` existen para evitar una migración de enum inmediata, pero este incremento no expone transiciones porque dependen de pagos y reglas de anulación aún no confirmadas.
46. **Historial financiero restringido:** tarifas y cuotas no se borran físicamente. Las claves foráneas de cuota hacia alumno, inscripción y tarifa usan `ON DELETE RESTRICT`.

## Reglas ambiguas: no implementar

- Fórmula docente: base 50 %, umbral del alumno 11, alcance del 70 %, redondeo, ausencias y devoluciones.
- Significado y facturación de “Formación” y “Solo salón / alquiler”.
- Relación entre frecuencia semanal, clases elegidas y tarifa/plan.
- Alta de inscripción a mitad de mes, prorrateos y elección del primer período a cobrar.
- Conducta posterior al día 10, mora y recargos.
- Becas y combinación/prioridad de descuentos.
- Imputación de pagos parciales, saldo a favor, anulaciones y devoluciones.
- Apertura/cierre/arqueo de caja y cajas por sucursal o usuario.
- Recuperos, feriados, reemplazos y asistencia fuera de inscripción.
- Excepciones manuales de solapamiento, vigencias estacionales, clases canceladas, feriados y reemplazos.
- Tolerancias, pausas y horas docentes liquidables.
- Matriz concreta de permisos.
- Método de acceso y conducta ante deuda o vencimiento.
- Conflictos de horario entre clases de un alumno: impedir, advertir o permitir.
- Relación entre cupo de clase y capacidad de los salones.
- Recuperos y cambios de clase.
- Relación entre frecuencia semanal y tarifa.
- Promociones 2x1 y reglas concretas de Formación.
- Efectos de la cancelación general de una clase.
- Snapshot histórico de `Enrollment`: debe definirse antes de reportes financieros, asistencia histórica o liquidaciones si clase, profesor y horarios deben conservarse como estaban durante el período inscripto.
