# Modelo del dominio

## Contextos y entidades

- **Personas:** `Student`, `Teacher`, `AdminUser`, `Role`, `Permission`.
- **Oferta:** `DanceType`, `Class`, `ClassSchedule`, `Branch`, `Room`.
- **Inscripciones:** `Enrollment` une `Student` y `Class` con vigencia y estado.
- **Facturación:** `Tariff`, `MonthlyCharge`, `Payment` y `PaymentAllocation`; descuentos quedan diferidos.
- **Caja:** `CashRegister`, `CashSession`, `CashMovement`, `PaymentMethod`, `MovementCategory`.
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
- Las imputaciones no superan el importe del pago.
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
- `discountAmount` es cero en v1. Los estados disponibles son `PENDING`, `PAID` y `VOID`, pero v1 solamente crea `PENDING`; pagos y anulaciones se implementarán cuando existan sus reglas.
- Las relaciones financieras usan borrado restringido y las entidades se desactivan sin eliminar el historial.

## Pagos v1

- `Payment` pertenece a un alumno y conserva importe, medio, instante y usuario responsable.
- `PaymentAllocation` congela el importe completo de cada cuota; varias cuotas sólo pueden agruparse si pertenecen al mismo alumno.
- El backend calcula con decimales exactos. No existen pagos parciales, sobrepagos ni saldo a favor.
- El cobro bloquea cuotas y cambia `PENDING` a `PAID` atómicamente. La anulación conserva el historial, marca el pago `VOID` y devuelve las cuotas a `PENDING`.
- Una cuota liberada puede pagarse nuevamente. Los medios v1 son `CASH`, `MERCADO_PAGO` y `CARD`; Caja queda diferida.

## Usuarios y permisos v1

- `AdminUser` mantiene los roles técnicos existentes, presentados como Admisión (`RECEPTION`), Administración (`MANAGER`) y Dirección (`ADMINISTRATOR`).
- Los permisos se definen por capacidad y se validan en la API. El frontend usa la misma matriz conceptual para mostrar únicamente módulos y acciones habilitados.
- Admisión conserva la operación cotidiana de alumnos/inscripciones y lectura necesaria de oferta, tarifas y cuotas; no administra configuración, caja, usuarios, reportes ni liquidaciones.
- Administración gestiona configuración y usuarios de Admisión/Administración, pero no puede acceder a cuentas de Dirección ni aprobar liquidaciones.
- Dirección tiene el nivel completo. El sistema impide auto-desactivación y garantiza al menos una cuenta de Dirección activa.

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
