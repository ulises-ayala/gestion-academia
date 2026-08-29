import type { AuditLogDto } from '@academy/contracts';

export const auditEntityOptions = [
  ['', 'Todas'],
  ['STUDENT', 'Alumno'],
  ['TEACHER', 'Profesor'],
  ['DANCE_TYPE', 'Tipo de danza'],
  ['BRANCH', 'Sucursal'],
  ['ROOM', 'Salón'],
  ['ACADEMY_CLASS', 'Clase'],
  ['TARIFF', 'Tarifa'],
  ['ADMIN_USER', 'Usuario'],
  ['PAYMENT', 'Pago'],
  ['ATTENDANCE', 'Asistencia'],
  ['ENROLLMENT', 'Inscripción'],
] as const;
export const auditActionOptions = [
  ['', 'Todas'],
  ['UPDATE', 'Actualización'],
  ['STATUS_CHANGE', 'Cambio de estado'],
  ['ROLE_CHANGE', 'Cambio de rol'],
  ['VOID', 'Anulación'],
  ['CORRECTION', 'Corrección'],
  ['END', 'Finalización'],
] as const;

const entityLabels = Object.fromEntries(auditEntityOptions);
const actionLabels = Object.fromEntries(auditActionOptions);
const fieldLabels: Record<string, string> = {
  firstName: 'Nombre',
  lastName: 'Apellido',
  phone: 'Teléfono',
  email: 'Correo',
  address: 'Domicilio',
  status: 'Estado',
  role: 'Rol',
  amount: 'Importe',
  baseAmount: 'Importe base',
  discountAmount: 'Descuento',
  finalAmount: 'Importe final',
  name: 'Nombre',
  capacity: 'Cupo',
  level: 'Nivel',
  teacherId: 'Profesor',
  danceTypeId: 'Tipo de danza',
  validFrom: 'Vigente desde',
  validTo: 'Vigente hasta',
  endDate: 'Fecha de finalización',
  dueDate: 'Vencimiento',
  notes: 'Observaciones',
  username: 'Usuario',
  paymentMethod: 'Medio de pago',
  passwordChanged: 'Contraseña modificada',
};
const valueLabels: Record<string, string> = {
  CONFIRMED: 'Confirmado',
  VOID: 'Anulado',
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  RECEPTION: 'Admisión',
  MANAGER: 'Administración',
  ADMINISTRATOR: 'Dirección',
  PRESENT: 'Presente',
  ABSENT: 'Ausente',
  JUSTIFIED: 'Justificada',
  ENDED: 'Finalizada',
  CASH: 'Efectivo',
  MERCADO_PAGO: 'Mercado Pago',
  CARD: 'Tarjeta',
};
const moneyFields = new Set(['amount', 'baseAmount', 'discountAmount', 'finalAmount']);
const dateFields = new Set(['validFrom', 'validTo', 'endDate', 'dueDate']);

export const formatAuditEntity = (value: string) => entityLabels[value] ?? humanize(value);
export const formatAuditAction = (value: string) => actionLabels[value] ?? humanize(value);
export const formatAuditField = (value: string) => fieldLabels[value] ?? humanize(value);
export const auditActionTone = (action: string) =>
  action === 'VOID'
    ? 'danger'
    : action === 'CORRECTION' || action === 'ROLE_CHANGE'
      ? 'warning'
      : 'brand';
export const shortAuditId = (value: string | null) => (value ? `${value.slice(0, 8)}…` : '');

export function formatAuditValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' && valueLabels[value]) return valueLabels[value];
  if (moneyFields.has(field) && (typeof value === 'string' || typeof value === 'number'))
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(
      Number(value),
    );
  if (dateFields.has(field) && typeof value === 'string')
    return new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC' }).format(
      new Date(`${value.slice(0, 10)}T00:00:00.000Z`),
    );
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (Array.isArray(value)) return `${value.length} elemento${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'object') return 'Información actualizada';
  return String(value);
}

export function getChangedAuditFields(log: Pick<AuditLogDto, 'before' | 'after'>) {
  const before = log.before ?? {};
  const after = log.after ?? {};
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
    .map((field) => ({
      field,
      label: formatAuditField(field),
      before: formatAuditValue(field, before[field]),
      after: formatAuditValue(field, after[field]),
    }));
}

function humanize(value: string) {
  const spaced = value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : value;
}
