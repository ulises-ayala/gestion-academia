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

## Decisiones confirmadas para pagos y futura caja

51. **Cuota por clase/inscripción:** cada cuota corresponde a una inscripción y, por lo tanto, a una clase. Varias clases generan varias cuotas; el precio de referencia actual es ARS 40.000 por clase. Se mantiene `Enrollment 1 -> N MonthlyCharge` con unicidad por inscripción y período.
52. **Pago parcial confirmado:** una cuota puede recibir varios pagos confirmados y un `Payment` puede cubrir una o más cuotas del mismo alumno. El sobrepago y el saldo a favor no están admitidos.
53. **Actor financiero autenticado:** todo pago tendrá un usuario administrativo responsable. Las futuras operaciones financieras deben obtener `AdminUser.id` desde la sesión autenticada mediante `CurrentUser`; nunca deben aceptar `createdByUserId` o `responsibleUserId` del body como autoridad.
54. **Anulaciones y devoluciones:** se permitirá anular pagos. Las devoluciones no están confirmadas y no se implementarán ni se creará un permiso para ellas hasta definir sus reglas.
55. **Vencimiento sin estado adicional:** el vencimiento mensual debe caer entre los días 1 y 10. Actualmente no hay intereses ni recargos por mora. Una cuota `PENDING` o `PARTIAL` con saldo abierto y fecha actual posterior a `dueDate` se considera vencida de forma derivada, sin persistir un estado `OVERDUE`.
56. **Caja y arqueo:** el negocio requiere arqueos de caja. La apertura y el cierre formal de caja todavía no están confirmados y no se presupone ese flujo.
57. **Medios de pago modelados:** cada pago puede combinar efectivo, Mercado Pago y tarjeta con un importe por medio. Transferencia bancaria debe reconfirmarse antes de incorporarse.

## Decisiones de Asistencias de alumnos v1

58. **Identidad por inscripción y fecha:** `StudentAttendance` pertenece a `Enrollment` y la base garantiza una sola asistencia por `enrollmentId + attendanceDate`. Corregir una asistencia no permite cambiar esa identidad histórica.
59. **Vigencia histórica:** una asistencia sólo puede registrarse dentro de `startDate` y `endDate` inclusive. Una inscripción actualmente `ENDED` admite consulta y registro histórico si la fecha pertenece a su vigencia.
60. **Roster por fecha:** `GET /attendances/roster` obtiene desde la API las inscripciones vigentes para la clase y fecha y adjunta la asistencia existente. El frontend no reconstruye el roster a partir de inscripciones activas hoy.
61. **Estados y conservación:** v1 admite `PRESENT`, `ABSENT` y `JUSTIFIED`, con observación opcional y sin borrado físico. El historial se preserva aunque finalice la inscripción o el alumno deje la clase.
62. **Dos flujos, una asistencia:** Asistencias ofrece Pasar lista por clase e Ingreso rápido por alumno. Ambos crean o corrigen el mismo `StudentAttendance` mediante los casos de uso existentes.
63. **Búsqueda sin identidad financiera:** DNI, nombre, apellido y nombre completo solamente localizan al `Student`. La asistencia siempre se registra contra una `Enrollment` concreta elegida por el usuario; no se consultan cuotas ni deuda.
64. **Selección asistida:** el ingreso rápido devuelve todas las inscripciones vigentes en la fecha. Si existen varias, cada una conserva su propia acción. Los horarios del día seleccionado se priorizan visualmente, pero nunca excluyen otras clases, deciden automáticamente ni aplican tolerancias.
65. **Caso de uso reutilizable:** `GET /attendances/quick-search` concentra búsqueda de persona, vigencia de inscripciones, clase, profesor, horarios y asistencia existente. Un futuro módulo de Acceso podrá reutilizar esta capacidad, pero este incremento no automatiza ingresos ni incorpora dispositivos.

## Decisiones de datos de desarrollo

66. **Seed local explícito y protegido:** los datos ficticios se cargan únicamente mediante `npm run db:seed`. El comando exige `NODE_ENV=development`, rechaza CI y limita `DATABASE_URL` a PostgreSQL local con base `academy`; no forma parte de builds, migraciones ni despliegues.

67. **Identidades reservadas e idempotencia:** las entidades del dataset usan identificadores UUID reservados o claves naturales únicas y se actualizan mediante `upsert`. El seed no vacía tablas ni borra registros manuales, y puede repetirse sin duplicar el conjunto administrado.

68. **Fechas útiles para QA:** el día actual, el período de cuota vigente y los escenarios históricos se calculan en `America/Argentina/Buenos_Aires`. Esto mantiene vigentes los casos de roster, asistencia y cuotas sin congelarlos a una fecha del equipo que ejecuta el comando.

## Decisiones de flujo diario de Asistencias

69. **Jornada como entrada principal:** Asistencias se organiza alrededor de la fecha seleccionada. La pantalla inicial consulta las clases con un horario activo cuyo día semanal coincide con esa fecha, ordenadas por hora de inicio; la cantidad de alumnos usa la vigencia histórica de cada inscripción y no solamente su estado actual.

70. **Búsqueda contextual:** la búsqueda principal exige una inscripción vigente en una clase programada para el día seleccionado y no devuelve alumnos cuando el texto está vacío. Consultar otras inscripciones vigentes se conserva como una acción secundaria explícita para excepciones todavía no modeladas.

71. **Ausencia visual, confirmación explícita:** un alumno sin asistencia persistida parte visualmente como `ABSENT`, pero abrir el roster no escribe datos. `Guardar lista` confirma de forma transaccional los estados `PRESENT`, `ABSENT` y `JUSTIFIED`, creando faltantes y actualizando existentes mediante la identidad única `enrollmentId + attendanceDate`.

72. **Una fuente de asistencia:** el ingreso rápido y el roster leen y modifican el mismo `StudentAttendance`. No se crean sesiones de clase, estadísticas persistidas ni dependencias con cuotas, pagos o deuda.

## Decisiones de conflictos horarios de Inscripciones

73. **Conflicto semanal del alumno:** el backend rechaza una inscripción cuando su clase y otra inscripción temporalmente coexistente del alumno tienen al menos dos horarios activos del mismo día que se superponen. Los intervalos son semiabiertos, por lo que horarios contiguos y horarios de días distintos se permiten; todas las combinaciones de horarios se evalúan.

74. **Vigencia histórica de la inscripción:** la búsqueda de conflictos no depende solamente de `Enrollment.status`. Una inscripción finalizada participa si `endDate >= startDate` de la nueva inscripción; una finalizada antes no bloquea. La nueva inscripción no tiene fecha final y se considera abierta.

75. **Autoridad y concurrencia:** el alta adquiere advisory locks transaccionales en orden determinístico para la clase y el alumno. Esto conserva la coordinación de cupo por clase y serializa dos altas simultáneas del mismo alumno antes de consultar conflictos. La API responde `ENROLLMENT_SCHEDULE_CONFLICT` con información mínima de la clase y horario conflictivos.

76. **Límite histórico de horarios:** `ClassSchedule` conserva versiones inactivas, pero no registra desde/hasta de cada programación. Por lo tanto, la regla compara los horarios actualmente `ACTIVE` de las clases y no puede reconstruir qué versión estaba vigente durante períodos históricos. Resolver esa reconstrucción requiere un modelado separado y no forma parte de este incremento.

## Decisiones del seed de staging

77. **Seeds separados por entorno:** `npm run db:seed` conserva sus restricciones de desarrollo local y base `academy`; `npm run db:seed:staging` es un comando distinto, manual y exclusivo de `academy_staging`. Ningún seed forma parte del deploy y producción real no admite seeds.

78. **Confirmación y destino verificado:** staging exige `NODE_ENV=production`, `ALLOW_STAGING_SEED=true`, `STAGING_SEED_TARGET=academy_staging`, `STAGING_SEED_CONFIRM=SEED_ACADEMY_STAGING`, contraseña obligatoria y que el nombre extraído de una URL PostgreSQL sea exactamente `academy_staging`. Estas condiciones conjuntas evitan interpretar `NODE_ENV=production` como autorización suficiente.

79. **Dataset compartido y aislado:** desarrollo y staging aplican el mismo escenario ficticio, fechas y entidades reservadas mediante una única implementación transaccional e idempotente. El seed sólo actualiza identidades propias, no vacía tablas y no borra ni modifica datos manuales ajenos.

80. **Cuentas demo de staging:** los tres roles usan identidades reservadas `demo-*` y una contraseña recibida únicamente mediante `STAGING_SEED_PASSWORD`, validada y hasheada con las mismas funciones de la aplicación. No existe valor predeterminado ni se registra el secreto.

## Decisiones históricas de Pagos v1

Las decisiones 81–88 describen el contrato anterior y quedan reemplazadas por Pagos v2 core para pagos parciales, medios combinados, imputación y anulación. Se conservan para registrar la evolución del módulo.

81. **Cuotas completas y mismo alumno:** un `Payment` cancela una o varias cuotas completas pertenecientes a un único alumno. No existen pagos parciales, crédito ni sobrepago.
82. **Importe bajo autoridad del servidor:** el cliente envía solamente IDs de cuotas y medio. El servidor copia cada `finalAmount`, suma con `Decimal` y deriva `studentId`.
83. **Actor y fecha reales:** `createdByUserId` proviene de `CurrentUser` y `paidAt` del reloj del servidor; v1 no admite fechas retroactivas.
84. **Medio único confirmado:** cada pago usa exactamente uno entre efectivo, Mercado Pago o tarjeta. Transferencia y medios combinados quedan diferidos.
85. **Concurrencia de cobro:** las cuotas se ordenan y bloquean dentro de una transacción serializable con reintentos de `P2034`; después del lock se revalida `PENDING`.
86. **Anulación histórica:** un pago nunca se elimina. Anularlo lo marca `VOID`, registra actor/instante y devuelve sus cuotas a `PENDING`.
87. **Repago permitido:** una cuota liberada puede pagarse nuevamente; la unicidad se limita a `paymentId + monthlyChargeId`.
88. **Caja diferida:** `Payment` queda como fuente financiera futura, pero Pagos v1 no crea sesiones ni movimientos de caja.

## Decisiones de Alta rápida de alumnos v1

89. **Caso de uso compuesto, no dominio nuevo:** Alta rápida orquesta Students, Enrollments, Billing y Payments mediante reglas existentes. No persiste una entidad `StudentOnboarding` ni modifica el schema; `POST /students` continúa disponible para el alta simple.
90. **Inscripción y cuota inicial opcionales:** el alta admite cero, una o varias clases. Cada clase seleccionada crea un `Enrollment` y una `MonthlyCharge` completa para la tarifa y período elegidos, sin prorrateo ni cuotas futuras automáticas.
91. **Pago único opcional:** las cuotas iniciales pueden quedar `PENDING` o cancelarse mediante un solo `Payment`, con una imputación por cuota. El cliente no envía un importe; Payments conserva la autoridad sobre `finalAmount`, suma, actor y fecha.
92. **Atomicidad con las protecciones vigentes:** el orquestador ejecuta todo en una transacción serializable. Los repositorios se vinculan al cliente transaccional compartido y conservan advisory locks de inscripción, locks de cuotas y reintentos ante conflictos; cualquier error revierte alumno, inscripciones, cuotas y pago.
93. **Permiso operativo acotado:** generar las cuotas iniciales forma parte del caso de uso autorizado por `students:manage` y `enrollments:manage`; no concede `charges:manage` ni acceso global a administración de cuotas. Cobrar además exige `payments:collect`. La matriz de roles no cambia.

## Decisiones de Responsive administrativo v1

98. **Mobile utilizable sin rediseñar desktop:** todas las pantallas administrativas deben conservar su información y acciones desde 320 px. Desktop mantiene la composición aprobada; formularios, filtros, pagos y asistencias se apilan sólo cuando el viewport lo requiere.
99. **Tablas legibles como fichas:** debajo de 640 px las tablas densas conservan un único markup semántico, pero cada fila se presenta verticalmente con etiquetas `data-label`. No se ocultan columnas ni se depende de scroll horizontal para comprender datos de negocio.
100.  **Sin overflow global:** shell, cards, textos largos y grids usan límites flexibles y wrapping. El scroll horizontal global no forma parte de la navegación; cualquier necesidad especializada debe quedar contenida localmente.
101.  **Browser antes que empaquetado:** la experiencia responsive del navegador es prioritaria. PWA, manifest, service worker y aplicaciones instalables quedan fuera de este incremento.

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

# Auditoría y trazabilidad v1

- `AuditLog` es un historial de negocio append-only: la API sólo expone lectura y no existen endpoints de edición o eliminación.
- El actor se deriva exclusivamente de `CurrentUser`; `createdAt` lo genera PostgreSQL en UTC.
- Las modificaciones sensibles y su auditoría se escriben en una única transacción Prisma. Si el registro de auditoría falla, también se revierte la mutación.
- Los snapshots `before`/`after` son selecciones intencionales. La sanitización central excluye contraseñas, hashes, tokens, cookies, credenciales y secretos; un cambio de contraseña se representa únicamente como `passwordChanged: true`.
- La anulación de pagos exige un motivo no vacío de hasta 500 caracteres y conserva el pago anulado y sus datos propios de anulación.
- Administración y Dirección poseen `audit:read`; Admisión no puede consultar el historial.
- Auditoría de negocio no reemplaza logs técnicos u observabilidad. No se auditan lecturas, búsquedas, sesiones, cargas de páginas ni la creación inicial habitual de asistencias.
- No existe borrado ni política de retención automática para auditoría en v1.

## Decisiones de ficha integral del alumno v1

102. **Composición sobre recursos existentes:** la ficha 360 combina alumno, inscripciones, cuotas, pagos y asistencias sin crear un agregado general ni persistencia nuevos. Asistencias amplía su listado con filtros `studentId` y `limit`; Payments expone una agregación read-only del total confirmado. Así se evitan consultas por cada clase y la carga de todo el historial de pagos.
103. **Métricas derivadas y fecha de negocio:** clases activas, deuda, vencimientos y total pagado se calculan a partir de datos autorizados por la API. Una cuota vence cuando conserva saldo abierto y su fecha es anterior al día de negocio de Buenos Aires; los pagos anulados no integran saldos ni totales pagados.
104. **Historia sin snapshots implícitos:** las inscripciones finalizadas conservan clase y fechas, pero la ficha no presenta al profesor actual como si fuera necesariamente el profesor histórico. No se agregan snapshots ni migraciones.
105. **Visibilidad por capacidades:** cada bloque y acción respeta los permisos existentes. Ocultar una opción en la interfaz no reemplaza la autorización de la API.
106. **Alcance administrativo confirmado:** la ficha reutiliza los casos de uso vigentes para editar, cambiar estado y finalizar inscripciones, incluidos sus registros de auditoría. No incorpora pausas, becas, motivos de baja, alertas automáticas ni acciones financieras nuevas.
107. **Asistencia observada, no esperada:** el resumen cuenta únicamente registros recientes `PRESENT`, `ABSENT` y `JUSTIFIED`. No calcula porcentajes ni sesiones esperadas porque el modelo no representa todas las ocurrencias reales de una clase.

## Feedback visual Carmesí

108. **Marca presente, superficies legibles:** fondos, sidebar, hovers y bordes reciben un matiz carmesí tanto en modo claro como oscuro, mientras las superficies principales continúan claras o neutrales. Los colores de éxito, advertencia y peligro conservan su significado semántico.
109. **Contraseña visible sólo en la UI:** login y creación inicial permiten mostrar u ocultar el valor del mismo campo local. El control no duplica, registra ni modifica la contraseña, el payload, el autocomplete ni la autenticación backend.

## Potenciales alumnos v1

110. **Seguimiento manual y flexible:** los cinco estados comerciales pueden cambiarse libremente y no constituyen una máquina de estados. Fechas, contactos y observaciones se registran manualmente; no existen mensajes, recordatorios, cron jobs ni integraciones con WhatsApp o Instagram.
111. **Historia sin borrado ni conversión implícita:** Leads no expone `DELETE`; “No concretó” conserva el registro. Marcar “Inscripto/a” tampoco crea Student, Enrollment, MonthlyCharge o Payment. Una conversión futura reutilizará Student Onboarding.
112. **Duplicados como ayuda operativa:** teléfono, email e Instagram se normalizan en campos auxiliares indexados, pero no únicos. Las coincidencias generan una advertencia y siempre permiten continuar porque los datos de contacto pueden compartirse o corregirse.
113. **Seguimiento vencido derivado:** “Con seguimiento pendiente” incluye cualquier fecha programada en una etapa abierta; `nextFollowUpAt < now` forma el subconjunto vencido. Ambos filtros se limitan a Consulta, Interesado/a y Clase de prueba; Inscripto/a y No concretó son etapas finales y no se persiste un estado adicional.
114. **Permiso y auditoría existentes:** `leads:manage` pertenece a Admisión y, por herencia, Administración y Dirección. Los cambios se auditan atómicamente como entidad `LEAD` mediante AuditLog; la creación habitual mantiene el criterio vigente y no genera auditoría.

## Dashboard operativo v1

115. **Lectura agregada y sin persistencia:** Inicio consume `GET /api/v1/dashboard/operational`, un read model que calcula indicadores sobre las entidades vigentes. No crea snapshots, sesiones de clase, alertas persistidas ni migraciones.
116. **Fecha de negocio consistente:** clases, vencimientos, cobros, asistencias y seguimientos de hoy usan el día calendario de `BUSINESS_TIMEZONE`, inicialmente `America/Buenos_Aires`. Los pagos anulados y las cuotas no pendientes quedan fuera de los totales operativos.
117. **Visibilidad por capacidades existentes:** el endpoint ejecuta y devuelve solamente las secciones autorizadas por los permisos de alumnos, oferta, cuotas, pagos, asistencias, potenciales y auditoría. No se incorpora `dashboard:read`; ocultar bloques o accesos rápidos sigue sin reemplazar la autorización backend.
118. **Programación versus actividad real:** las clases de hoy derivan de clase y horario activos para el día semanal; no presuponen que la clase ocurrió. Asistencia resume únicamente registros persistidos de la fecha y clases distintas alcanzadas por esos registros.

### Indicadores financieros preliminares

- La evolución mensual suma exclusivamente `Payment` con estado `CONFIRMED` según `paidAt`; los pagos `VOID` permanecen en su historial pero quedan excluidos de todos los importes.
- La serie contiene el mes calendario actual y los cinco anteriores, incluso cuando un período suma cero. Sus límites se calculan en `America/Buenos_Aires` y la agregación ocurre en base de datos.
- Los importes describen cobros registrados, no un indicador contable ni un saldo disponible. Un análisis económico completo requiere modelar previamente entradas, egresos, costos y liquidaciones.
- La sección exige `reports:operational`: solamente Administración y Dirección reciben sus datos; Admisión no los recibe en la respuesta.

### Navegación contextual v1

- Inicio funciona como centro operativo: las acciones rápidas aparecen inmediatamente después del saludo y antes de los indicadores.
- Las métricas accionables usan enlaces profundos y los filtros principales de Alumnos, Pagos, Potenciales y Asistencias pueden inicializarse desde la URL. El historial del navegador conserva así el contexto de origen.
- Deuda pendiente y cuotas vencidas abren una vista paginada de cuentas pendientes en Pagos, no una lista genérica de alumnos. La agrupación se realiza en base de datos sobre el saldo real y el cobro reutiliza Payments v2 core.
- Esta navegación deriva información existente y no incorpora notificaciones persistidas, tareas de fondo ni un nuevo estado financiero.

## Decisiones de Pagos v2 core

119. **Pago parcial sin crédito temporal:** el cliente envía `studentId` y uno o más medios con importe positivo. La API rechaza cualquier total superior al saldo abierto con `PAYMENT_EXCEEDS_OUTSTANDING_BALANCE`; no crea crédito ni saldo a favor. Este rechazo es una limitación temporal de Payments v2 core mientras se define el tratamiento de excedentes y no una regla comercial definitiva de Carmesí.
120. **Imputación oldest-first bajo autoridad del servidor:** el servidor distribuye el total por `dueDate`, `createdAt` e `id` ascendentes. El cliente puede previsualizar esa distribución, pero no elige ni envía IDs o importes de cuotas.
121. **Tres importes equivalentes:** `Payment.amount` es exactamente la suma de `PaymentTender.amount` y de `PaymentAllocation.amount`. Todos los cálculos monetarios usan `Decimal(12,2)`; cada medio puede aparecer como máximo una vez por pago.
122. **Saldo derivado:** `paidAmount` suma imputaciones de pagos `CONFIRMED`; `outstandingAmount` es `max(finalAmount - paidAmount, 0)`. No se persisten acumuladores duplicados. Una cuota abierta queda `PENDING` sin pagos, `PARTIAL` con cobertura incompleta y `PAID` al cubrirse completamente.
123. **Vencimiento derivado:** una cuota está vencida cuando conserva saldo abierto y `dueDate` es anterior al día de negocio en `America/Buenos_Aires`. `OVERDUE` no se persiste como estado.
124. **Concurrencia por alumno:** el cobro adquiere un advisory lock por alumno, bloquea sus cuotas abiertas en orden estable, vuelve a leer imputaciones confirmadas y ejecuta con aislamiento serializable y reintentos acotados. Dos cajas no pueden consumir la misma deuda.
125. **Anulación con historia intacta:** anular marca el pago `VOID` y conserva tenders e imputaciones. Cada cuota afectada se recalcula usando los demás pagos confirmados, por lo que puede resultar `PENDING`, `PARTIAL` o `PAID`.
126. **Migración compatible:** cada pago v1 se transforma en un pago con un único tender del mismo medio e importe antes de eliminar `payments.payment_method`. Caja, saldo a favor, devoluciones, transferencia bancaria, mora, recargos y descuentos permanecen fuera de alcance.

## Payments v2 — centro operativo

127. **Pagos como centro de cuentas:** `/payments` abre por defecto las cuentas con saldo y no exige seleccionar previamente un alumno. El read model de receivables agrupa saldos por alumno, calcula el resumen sobre todo el filtro y resuelve búsqueda, orden y paginación en base de datos reutilizando únicamente imputaciones de pagos confirmados.
128. **Contexto conservado en URL:** cuentas con saldo, vencidas, parciales y sin pagos usan `view`, `q`, `sort` y `page`; los deep links del dashboard siguen apuntando a `view=pending|overdue`. Entrar al estado de cuenta y volver conserva el contexto mediante la historia del navegador y parámetros existentes, sin redirects ni rutas externas.
129. **Dos lecturas, un mismo módulo:** Cuentas por cobrar es la vista operativa principal e Historial de cobros permite revisar pagos globales paginados. Sus filtros por alumno, estado, fecha y `PaymentTender` se ejecutan server-side; un pago mixto aparece en cada filtro de medio que integra.
130. **Student mode preservado:** `studentId` mantiene saldos, pagos parciales, preview oldest-first, cobro mixto, historial y anulación de Payments v2 core. Esta iteración agrega solamente navegación, filtros y modelos de lectura: no incorpora reglas financieras, permisos, schema ni migraciones.
