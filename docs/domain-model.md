# Modelo del dominio

## Caja por turno v1

- `CashShift` pertenece a un usuario y no se elimina ni reabre. Un índice parcial garantiza un único turno `OPEN` por usuario.
- `CashMovement` es append-only. Cada tender genera una `COLLECTION`; anular el pago genera su `REVERSAL`, incluso después del cierre. El esperado actual es collections menos reversals por `CASH`, `MERCADO_PAGO` y `CARD`.
- `CashShiftClosingLine` conserva el snapshot inmutable visto al cerrar: esperado, declarado y diferencia por medio. El backend bloquea el turno y recalcula lo esperado.
- `CashReconciliationCorrection` corrige únicamente lo declarado, con delta, antes/después, actor, instante y motivo. No permite inventar ni modificar movimientos financieros.
- V1 no tiene fondo inicial, Income, Expenses, retiros, depósitos, créditos, refunds ni liquidaciones. Payments anteriores no reciben un turno inventado: no hay backfill histórico.

## Contextos y entidades

- **Personas:** `Lead`, `Student`, `Teacher`, `AdminUser`, `Role`, `Permission`.
- **Oferta:** `DanceType`, `Class`, `ClassSchedule`, `Branch`, `Room`.
- **Inscripciones:** `Enrollment` une `Student` y `Class` con vigencia y estado.
- **Facturación:** `Tariff`, `MonthlyCharge`, `Payment`, `PaymentTender` y `PaymentAllocation`; descuentos quedan diferidos.
- **Caja:** `CashShift`, `CashMovement`, `CashShiftClosingLine` y `CashReconciliationCorrection`.
- **Asistencia:** `StudentAttendance` pertenece a una `Enrollment`; asistencia docente queda diferida.
- **Acceso:** `AccessAttempt` registra decisión/mecanismo sin acoplar hardware.
- **Liquidaciones:** `SettlementPolicy`, `TeacherSettlement`, `SettlementLine`; sin fórmula hasta relevarla.

```mermaid
erDiagram
  BRANCH ||--o{ ROOM : contiene
  DANCE_TYPE ||--o{ CLASS : categoriza
  TEACHER ||--o{ CLASS : dicta
  CLASS ||--o{ CLASS_SCHEDULE : programa
  ROOM ||--o{ CLASS_SCHEDULE : aloja
  STUDENT ||--o{ ENROLLMENT : realiza
  CLASS ||--o{ ENROLLMENT : recibe
  STUDENT ||--o{ MONTHLY_CHARGE : adeuda
  ENROLLMENT ||--o{ MONTHLY_CHARGE : origina
  TARIFF ||--o{ MONTHLY_CHARGE : valoriza
  STUDENT ||--o{ PAYMENT : realiza
  PAYMENT ||--|{ PAYMENT_TENDER : compone
  PAYMENT ||--|{ PAYMENT_ALLOCATION : imputa
  MONTHLY_CHARGE ||--o{ PAYMENT_ALLOCATION : recibe
  ADMIN_USER ||--o{ PAYMENT : registra
  ENROLLMENT ||--o{ STUDENT_ATTENDANCE : registra
  ADMIN_USER ||--o{ CASH_MOVEMENT : carga
  TEACHER ||--o{ TEACHER_SETTLEMENT : liquida
```

## Invariantes previstas

- No hay dos inscripciones activas para igual alumno/clase.
- Versiones de una tarifa no superponen vigencias.
- Una cuota conserva importes base, descuento y final históricos.
- La suma de medios y la suma de imputaciones coinciden exactamente con el importe del pago.
- Cupos e importes no son negativos; el fin de horario es posterior al inicio.
- Conflictos de salón/profesor se validarán transaccionalmente al confirmar excepciones.

## Oferta Académica v1

- `Teacher` mantiene identidad y ciclo de vida separados de `Student`.
- `DanceType` categoriza clases concretas.
- `Branch` contiene uno o más `Room`; cada horario deriva su sucursal desde el salón.
- `AcademyClass` representa la oferta concreta y tiene un profesor responsable, tipo de danza, nivel opcional y cupo positivo.
- `ClassSchedule` normaliza día, hora local de inicio/fin y salón. Una clase puede tener varios horarios.
- No se permiten superposiciones de salón ni profesor para clases activas. Los intervalos contiguos son válidos.
- No existe relación alumno–clase hasta implementar `Enrollment` en Inscripciones v1.

## Inscripciones v1

- `Enrollment` vincula un `Student` con una `AcademyClass` y conserva su propio período e historial.
- Una inscripción comienza `ACTIVE` con una `startDate` explícita y finaliza como `ENDED` con `endDate`; nunca se elimina físicamente.
- Solo alumnos y clases activas admiten nuevas inscripciones. Una pareja alumno/clase puede tener una sola inscripción activa, pero múltiples períodos finalizados.
- `AcademyClass.capacity` es la autoridad del cupo. El alta serializa por clase y cuenta inscripciones activas antes de confirmar.
- Un alumno no puede tener períodos de inscripción coexistentes en clases cuyos horarios semanales activos se superpongan el mismo día. Se permiten horarios contiguos y horarios iguales en días distintos.
- La validación compara todas las combinaciones de horarios y se serializa por alumno en el backend. Como los horarios no tienen fechas de vigencia propias, el historial se evalúa contra la programación actualmente activa.
- Un horario solo es operacional cuando `AcademyClass.status == ACTIVE` y `ClassSchedule.status == ACTIVE`.

## Tarifas y Cuotas v1

- `Enrollment` continúa siendo una inscripción persistente: no se crea otra inscripción al cambiar el mes.
- Una cuota mensual (`MonthlyCharge`) corresponde a una inscripción y conserva también `studentId`. Por eso dos inscripciones activas del mismo alumno pueden originar dos cuotas en el mismo período.
- Existe como máximo una cuota por `Enrollment` y período `AAAA-MM`; la base lo refuerza con una restricción única.
- `Tariff` define nombre, monto, vigencia y estado. Solamente una tarifa activa y vigente puede utilizarse en una generación nueva.
- La generación es manual y requiere indicar inscripción, tarifa, período y fecha de vencimiento. No existe cron ni generación implícita.
- El vencimiento debe encontrarse entre el día 1 y el 10 del mismo período.
- La cuota congela `baseAmount`, `discountAmount` y `finalAmount`. Cambiar una tarifa después no modifica cuotas existentes.
- `discountAmount` es cero en v1. `PENDING`, `PARTIAL` y `PAID` reflejan respectivamente deuda intacta, pago parcial y deuda cubierta; `VOID` queda reservado para una cuota anulada.
- Las relaciones financieras usan borrado restringido y las entidades se desactivan sin eliminar el historial.

## Pagos v2 core

- `Payment` pertenece a un alumno y conserva importe, instante y usuario responsable. Uno o más `PaymentTender` desglosan efectivo, Mercado Pago y tarjeta; un medio no se repite dentro del pago.
- `PaymentAllocation` registra cuánto del pago se aplicó a cada cuota. La suma de tenders, el importe del pago y la suma de imputaciones son iguales y se calculan con decimales exactos.
- El backend recibe alumno y medios, calcula la deuda vigente y distribuye oldest-first por vencimiento con desempate estable por creación e ID. Se admiten pagos parciales y derrame entre cuotas, pero no sobrepago ni saldo a favor.
- `paidAmount`, `outstandingAmount` y vencimiento son datos derivados exclusivamente de imputaciones pertenecientes a pagos `CONFIRMED`; no se persisten como saldos duplicados.
- El cobro usa advisory lock por alumno, locks de filas, aislamiento serializable y reintentos. Dos cajas no pueden consumir la misma deuda.
- Anular conserva `PaymentTender` y `PaymentAllocation`, marca el pago `VOID` y recalcula cada cuota con los demás pagos confirmados; puede quedar `PENDING`, `PARTIAL` o `PAID`.
- Caja, devoluciones, transferencia bancaria, mora, recargos y descuentos quedan diferidos.

## Usuarios y permisos v1

- `AdminUser` mantiene los roles técnicos existentes, presentados como Admisión (`RECEPTION`), Administración (`MANAGER`) y Dirección (`ADMINISTRATOR`).
- Los permisos se definen por capacidad y se validan en la API. El frontend usa la misma matriz conceptual para mostrar únicamente módulos y acciones habilitados.
- Admisión conserva la operación cotidiana de alumnos/inscripciones, lectura necesaria y gestión de su propia caja; no concilia cajas ajenas ni administra configuración, usuarios, reportes o liquidaciones.
- Administración gestiona configuración y usuarios de Admisión/Administración, pero no puede acceder a cuentas de Dirección ni aprobar liquidaciones.
- Dirección tiene el nivel completo. El sistema impide auto-desactivación y garantiza al menos una cuenta de Dirección activa.

## Potenciales alumnos v1

- `Lead` representa una consulta comercial previa al alta como alumno y utiliza un único `name` flexible; DNI, nacimiento y domicilio no forman parte de esta identidad.
- Los orígenes manuales son WhatsApp, Instagram y presencial. Los estados Consulta, Interesado, Clase de prueba, Inscripto y No concretó describen etapas editables libremente, no una máquina de estados.
- El seguimiento conserva una próxima fecha/hora opcional, último contacto explícito y observaciones. Un seguimiento está vencido cuando su fecha es anterior al instante actual y el estado continúa abierto.
- Teléfono, email e Instagram conservan el valor ingresado y tienen representaciones normalizadas auxiliares no únicas para advertir posibles duplicados.
- `ENROLLED` no crea `Student`, inscripción, cuota ni pago. Una futura conversión deberá reutilizar Student Onboarding.

## Asistencias de alumnos v1

- `StudentAttendance` pertenece a una `Enrollment`, no directamente a alumno, clase u horario.
- Existe como máximo una asistencia por inscripción y fecha mediante la unicidad `enrollmentId + attendanceDate`.
- Los estados admitidos son `PRESENT`, `ABSENT` y `JUSTIFIED`.
- La fecha debe pertenecer a la vigencia real de la inscripción: desde `startDate` hasta `endDate` inclusive cuando exista.
- El roster de una clase se calcula para la fecha consultada. Incluye inscripciones con `startDate <= fecha` y `endDate` nula o mayor/igual a la fecha, aunque actualmente estén `ENDED`.
- La asistencia existente se devuelve junto con cada alumno del roster y puede corregirse modificando solamente estado y observación.
- No existe borrado físico. Finalizar posteriormente una inscripción no elimina ni oculta su historial válido.
- La interfaz ofrece dos flujos sobre el mismo modelo: pasar lista por clase e ingreso rápido buscando al alumno por DNI o nombre.
- En ingreso rápido, `Student` identifica a la persona y cada resultado de `Enrollment` identifica la clase concreta sobre la que puede registrarse asistencia. Varias inscripciones vigentes se muestran por separado.
- Los horarios del día seleccionado sirven para ordenar y sugerir una clase, sin excluir otras inscripciones vigentes ni formar parte de la identidad de `StudentAttendance`.
- Asistencias no consulta cuotas, deuda ni vencimientos. El futuro contexto de Acceso podrá reutilizar la búsqueda, pero sus dispositivos y políticas permanecen fuera de este módulo.

## Dashboard operativo v1

- El dashboard es un modelo de lectura y no una entidad persistente.
- La agenda de hoy deriva de clases y horarios activos; no representa sesiones ni confirma que una clase haya ocurrido.
- Deuda, cobros y vencimientos respetan estados financieros históricos: las cuotas `PENDING`/`PARTIAL` aportan sólo su saldo abierto y únicamente pagos `CONFIRMED` participan de sus indicadores.
- Asistencia cuenta registros reales del día y no estima asistencias esperadas.
- Cada sección conserva el permiso del módulo que resume; Auditoría nunca se consulta ni se entrega sin `audit:read`.
- La evolución de cobros agrega únicamente pagos `CONFIRMED` de seis meses calendario. Es información preliminar de gestión y no reemplaza un futuro modelo contable completo.
- La vista de cuentas pendientes agrupa saldos abiertos de cuotas `PENDING`/`PARTIAL` por alumno. “Vencida” sigue siendo una condición derivada de `dueDate < businessToday`; no es un estado persistido nuevo.
