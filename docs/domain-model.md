# Modelo del dominio

## Contextos y entidades

- **Personas:** `Student`, `Teacher`, `AdminUser`, `Role`, `Permission`.
- **Oferta:** `DanceType`, `Class`, `ClassSchedule`, `Branch`, `Room`.
- **Inscripciones:** `Enrollment` une `Student` y `Class` con vigencia y estado.
- **Facturación:** `Tariff` y `MonthlyCharge`; pagos, imputaciones y descuentos quedan diferidos.
- **Caja:** `CashRegister`, `CashSession`, `CashMovement`, `PaymentMethod`, `MovementCategory`.
- **Asistencia:** `StudentAttendance`, `TeacherAttendance`.
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
  CLASS ||--o{ STUDENT_ATTENDANCE : registra
  STUDENT ||--o{ STUDENT_ATTENDANCE : asiste
  TEACHER ||--o{ TEACHER_ATTENDANCE : registra
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
