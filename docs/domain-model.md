# Modelo del dominio

## Contextos y entidades

- **Personas:** `Student`, `Teacher`, `AdminUser`, `Role`, `Permission`.
- **Oferta:** `DanceType`, `Class`, `ClassSchedule`, `Branch`, `Room`.
- **Inscripciones:** `Enrollment` une `Student` y `Class` con vigencia y estado.
- **Facturación:** `Rate`, `RateVersion`, `Discount`, `Fee`, `Payment`, `PaymentAllocation`.
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
  STUDENT ||--o{ FEE : adeuda
  RATE ||--o{ RATE_VERSION : historiza
  RATE_VERSION ||--o{ FEE : origina
  STUDENT ||--o{ PAYMENT : paga
  PAYMENT ||--o{ PAYMENT_ALLOCATION : distribuye
  FEE ||--o{ PAYMENT_ALLOCATION : cancela
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
