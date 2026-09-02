import type { AuditLogDto } from '@academy/contracts';

export const auditEntityOptions = [
  ['', 'Todas'],
  ['STUDENT', 'Alumno'],
  ['LEAD', 'Potencial alumno'],
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
  ['BILLING_CONDITION', 'Condición de facturación'],
  ['MONTHLY_CHARGE_ADJUSTMENT', 'Ajuste de cuota'],
  ['CASH_SHIFT', 'Turno de caja'],
] as const;
export const auditActionOptions = [
  ['', 'Todas'],
  ['UPDATE', 'Actualización'],
  ['STATUS_CHANGE', 'Cambio de estado'],
  ['ROLE_CHANGE', 'Cambio de rol'],
  ['VOID', 'Anulación'],
  ['CORRECTION', 'Corrección'],
  ['END', 'Finalización'],
  ['CREATE', 'Alta'],
  ['RENEW', 'Renovación'],
  ['OPEN', 'Apertura'],
  ['CLOSE', 'Cierre'],
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
  instagram: 'Instagram',
  source: 'Origen',
  nextFollowUpAt: 'Próximo seguimiento',
  lastContactAt: 'Último contacto',
  username: 'Usuario',
  paymentMethod: 'Medio de pago',
  tenders: 'Medios de pago',
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
  INQUIRY: 'Consulta',
  INTERESTED: 'Interesado/a',
  TRIAL: 'Clase de prueba',
  ENROLLED: 'Inscripto/a',
  NOT_CONVERTED: 'No concretó',
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  IN_PERSON: 'Presencial',
};
const moneyFields = new Set(['amount', 'baseAmount', 'discountAmount', 'finalAmount']);
const dateFields = new Set([
  'validFrom',
  'validTo',
  'endDate',
  'dueDate',
  'nextFollowUpAt',
  'lastContactAt',
]);

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
  if (field === 'tenders' && Array.isArray(value))
    return value
      .map((tender) => {
        if (!tender || typeof tender !== 'object') return '';
        const item = tender as Record<string, unknown>;
        const method =
          typeof item.method === 'string' ? (valueLabels[item.method] ?? item.method) : '';
        const amount =
          typeof item.amount === 'string' || typeof item.amount === 'number'
            ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(
                Number(item.amount),
              )
            : '';
        return [method, amount].filter(Boolean).join(': ');
      })
      .filter(Boolean)
      .join(' + ');
  if (typeof value === 'string' && valueLabels[value]) return valueLabels[value];
  if (moneyFields.has(field) && (typeof value === 'string' || typeof value === 'number'))
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(
      Number(value),
    );
  if (dateFields.has(field) && typeof value === 'string') {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    return new Intl.DateTimeFormat('es-AR', {
      timeZone: dateOnly ? 'UTC' : 'America/Buenos_Aires',
      ...(dateOnly ? {} : { dateStyle: 'short', timeStyle: 'short' }),
    }).format(new Date(dateOnly ? `${value}T00:00:00.000Z` : value));
  }
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
