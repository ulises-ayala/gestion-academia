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

## Decisiones de Usuarios y Permisos v1

47. **Mapeo de niveles confirmado:** se preservan los valores persistidos del enum para evitar una migración destructiva: `RECEPTION` representa Admisión, `MANAGER` representa Administración y `ADMINISTRATOR` representa Dirección.
48. **API como autoridad:** cada endpoint sensible declara permisos y un guard global los valida después de autenticar la sesión. Ocultar navegación o botones en el frontend es solamente una ayuda de interfaz.
49. **Matriz inicial:** Admisión gestiona alumnos e inscripciones, consulta oferta, tarifas, cuotas y pagos, y puede cobrar pagos completos. Administración agrega configuración, gestión de tarifas y cuotas, anulación de pagos, caja, arqueos, usuarios no pertenecientes a Dirección, reportes operativos y liquidaciones. Dirección agrega gestión de su propio nivel, reportes completos y aprobación de liquidaciones.
50. **Protección administrativa:** un usuario no puede desactivarse ni cambiar su propio rol. Debe permanecer al menos una cuenta activa de Dirección. Administración no puede listar, consultar, crear ni modificar cuentas de Dirección.

## Decisiones confirmadas para el futuro módulo de pagos y caja

51. **Cuota por clase/inscripción:** cada cuota corresponde a una inscripción y, por lo tanto, a una clase. Varias clases generan varias cuotas; el precio de referencia actual es ARS 40.000 por clase. Se mantiene `Enrollment 1 -> N MonthlyCharge` con unicidad por inscripción y período.
52. **Pago sin fraccionamiento:** no se admiten pagos parciales. Una cuota se paga completa, no puede dividirse entre pagos y un futuro `Payment` podrá cancelar una o más cuotas completas.
53. **Actor financiero autenticado:** todo pago tendrá un usuario administrativo responsable. Las futuras operaciones financieras deben obtener `AdminUser.id` desde la sesión autenticada mediante `CurrentUser`; nunca deben aceptar `createdByUserId` o `responsibleUserId` del body como autoridad.
54. **Anulaciones y devoluciones:** se permitirá anular pagos. Las devoluciones no están confirmadas y no se implementarán ni se creará un permiso para ellas hasta definir sus reglas.
55. **Vencimiento sin estado adicional:** el vencimiento mensual debe caer entre los días 1 y 10. Actualmente no hay intereses ni recargos por mora. Una cuota con `status == PENDING` y fecha actual posterior a `dueDate` puede considerarse vencida de forma derivada, sin persistir un estado `OVERDUE`.
56. **Caja y arqueo:** el negocio requiere arqueos de caja. La apertura y el cierre formal de caja todavía no están confirmados y no se presupone ese flujo.
57. **Medios de pago pendientes de modelado:** los medios confirmados son efectivo, Mercado Pago y tarjeta. Transferencia bancaria debe reconfirmarse antes de modelar o implementar el módulo de pagos.

## Decisiones de Asistencias de alumnos v1

58. **Identidad por inscripción y fecha:** `StudentAttendance` pertenece a `Enrollment` y la base garantiza una sola asistencia por `enrollmentId + attendanceDate`. Corregir una asistencia no permite cambiar esa identidad histórica.
59. **Vigencia histórica:** una asistencia sólo puede registrarse dentro de `startDate` y `endDate` inclusive. Una inscripción actualmente `ENDED` admite consulta y registro histórico si la fecha pertenece a su vigencia.
60. **Roster por fecha:** `GET /attendances/roster` obtiene desde la API las inscripciones vigentes para la clase y fecha y adjunta la asistencia existente. El frontend no reconstruye el roster a partir de inscripciones activas hoy.
61. **Estados y conservación:** v1 admite `PRESENT`, `ABSENT` y `JUSTIFIED`, con observación opcional y sin borrado físico. El historial se preserva aunque finalice la inscripción o el alumno deje la clase.
62. **Dos flujos, una asistencia:** Asistencias ofrece Pasar lista por clase e Ingreso rápido por alumno. Ambos crean o corrigen el mismo `StudentAttendance` mediante los casos de uso existentes.
63. **Búsqueda sin identidad financiera:** DNI, nombre, apellido y nombre completo solamente localizan al `Student`. La asistencia siempre se registra contra una `Enrollment` concreta elegida por el usuario; no se consultan cuotas ni deuda.
64. **Selección asistida:** el ingreso rápido devuelve todas las inscripciones vigentes en la fecha. Si existen varias, cada una conserva su propia acción. Los horarios del día seleccionado se priorizan visualmente, pero nunca excluyen otras clases, deciden automáticamente ni aplican tolerancias.
65. **Caso de uso reutilizable:** `GET /attendances/quick-search` concentra búsqueda de persona, vigencia de inscripciones, clase, profesor, horarios y asistencia existente. Un futuro módulo de Acceso podrá reutilizar esta capacidad, pero este incremento no automatiza ingresos ni incorpora dispositivos.

## Decisiones de flujo diario de Asistencias

66. **Jornada como entrada principal:** Asistencias se organiza alrededor de la fecha seleccionada. La pantalla inicial consulta las clases con un horario activo cuyo día semanal coincide con esa fecha, ordenadas por hora de inicio; la cantidad de alumnos usa la vigencia histórica de cada inscripción y no solamente su estado actual.
67. **Búsqueda contextual:** la búsqueda principal exige una inscripción vigente en una clase programada para el día seleccionado y no devuelve alumnos cuando el texto está vacío. Consultar otras inscripciones vigentes se conserva como una acción secundaria explícita para excepciones todavía no modeladas.
68. **Ausencia visual, confirmación explícita:** un alumno sin asistencia persistida parte visualmente como `ABSENT`, pero abrir el roster no escribe datos. `Guardar lista` confirma de forma transaccional los estados `PRESENT`, `ABSENT` y `JUSTIFIED`, creando faltantes y actualizando existentes mediante la identidad única `enrollmentId + attendanceDate`.
69. **Una fuente de asistencia:** el ingreso rápido y el roster leen y modifican el mismo `StudentAttendance`. No se crean sesiones de clase, estadísticas persistidas ni dependencias con cuotas, pagos o deuda.

## Decisiones de conflictos horarios de Inscripciones

70. **Conflicto semanal del alumno:** el backend rechaza una inscripción cuando su clase y otra inscripción temporalmente coexistente del alumno tienen al menos dos horarios activos del mismo día que se superponen. Los intervalos son semiabiertos, por lo que horarios contiguos y horarios de días distintos se permiten; todas las combinaciones de horarios se evalúan.
71. **Vigencia histórica de la inscripción:** la búsqueda de conflictos no depende solamente de `Enrollment.status`. Una inscripción finalizada participa si `endDate >= startDate` de la nueva inscripción; una finalizada antes no bloquea. La nueva inscripción no tiene fecha final y se considera abierta.
72. **Autoridad y concurrencia:** el alta adquiere advisory locks transaccionales en orden determinístico para la clase y el alumno. Esto conserva la coordinación de cupo por clase y serializa dos altas simultáneas del mismo alumno antes de consultar conflictos. La API responde `ENROLLMENT_SCHEDULE_CONFLICT` con información mínima de la clase y horario conflictivos.
73. **Límite histórico de horarios:** `ClassSchedule` conserva versiones inactivas, pero no registra desde/hasta de cada programación. Por lo tanto, la regla compara los horarios actualmente `ACTIVE` de las clases y no puede reconstruir qué versión estaba vigente durante períodos históricos. Resolver esa reconstrucción requiere un modelado separado y no forma parte de este incremento.

## Reglas ambiguas: no implementar

- Fórmula docente: base 50 %, umbral del alumno 11, alcance del 70 %, redondeo, ausencias y devoluciones.
- Significado y facturación de “Formación” y “Solo salón / alquiler”.
- Relación entre frecuencia semanal, clases elegidas y tarifa/plan.
- Alta de inscripción a mitad de mes, prorrateos y elección del primer período a cobrar.
- Becas y combinación/prioridad de descuentos.
- Devoluciones de pagos y cualquier tratamiento de saldo a favor.
- Transferencia bancaria como medio de pago.
- Apertura/cierre formal de caja y cajas por sucursal, usuario o caja única.
- Asistencia docente; recuperos, feriados, reemplazos y asistencia fuera de inscripción.
- Vinculación de la asistencia a un `ClassSchedule` específico.
- Acceso o registro de asistencia mediante DNI.
- Excepciones manuales de solapamiento, vigencias estacionales, clases canceladas, feriados y reemplazos.
- Tolerancias, pausas y horas docentes liquidables.
- Método de acceso y conducta ante deuda o vencimiento.
- Relación entre cupo de clase y capacidad de los salones.
- Recuperos y cambios de clase.
- Relación entre frecuencia semanal y tarifa.
- Promociones 2x1 y reglas concretas de Formación.
- Efectos de la cancelación general de una clase.
- Snapshot histórico de `Enrollment`: debe definirse antes de reportes financieros, asistencia histórica o liquidaciones si clase, profesor y horarios deben conservarse como estaban durante el período inscripto.
