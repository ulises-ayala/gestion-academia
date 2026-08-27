import { DomainError } from '../../shared/domain/domain-error';

export const attendanceStatuses = ['PRESENT', 'ABSENT', 'JUSTIFIED'] as const;
export type AttendanceStatus = (typeof attendanceStatuses)[number];

export const parseAttendanceDate = (value: string, field = 'attendanceDate') => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new DomainError('VALIDATION_ERROR', 'La fecha debe tener formato AAAA-MM-DD', { field });
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new DomainError('VALIDATION_ERROR', 'La fecha indicada no es válida', { field });
  return date;
};

export const parseAttendanceStatus = (value: unknown): AttendanceStatus => {
  if (typeof value !== 'string' || !attendanceStatuses.includes(value as AttendanceStatus))
    throw new DomainError('VALIDATION_ERROR', 'Estado de asistencia inválido', { field: 'status' });
  return value as AttendanceStatus;
};

export const normalizeAttendanceNotes = (value: unknown) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string')
    throw new DomainError('VALIDATION_ERROR', 'La observación debe ser texto', { field: 'notes' });
  const notes = value.trim();
  if (notes.length > 1000)
    throw new DomainError('VALIDATION_ERROR', 'La observación admite hasta 1000 caracteres', {
      field: 'notes',
    });
  return notes || null;
};

export type AttendanceData = Readonly<{
  id: string;
  enrollmentId: string;
  attendanceDate: Date;
  status: AttendanceStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}>;
