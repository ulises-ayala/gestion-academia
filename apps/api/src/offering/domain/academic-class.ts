import type { ClassScheduleInputDto, CreateClassDto, DayOfWeekDto } from '@academy/contracts';
import { DomainError } from '../../shared/domain/domain-error';
const days: DayOfWeekDto[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];
const required = (value: unknown, field: string, max: number) => {
  if (typeof value !== 'string' || !value.trim())
    throw new DomainError('VALIDATION_ERROR', `${field} es obligatorio`, { field });
  const result = value.trim();
  if (result.length > max)
    throw new DomainError('VALIDATION_ERROR', `${field} supera los ${max} caracteres`, { field });
  return result;
};
const optional = (value: unknown, field: string, max: number) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string')
    throw new DomainError('VALIDATION_ERROR', `${field} debe ser texto`, { field });
  const result = value.trim();
  if (result.length > max)
    throw new DomainError('VALIDATION_ERROR', `${field} supera los ${max} caracteres`, { field });
  return result || null;
};
const time = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw new DomainError('VALIDATION_ERROR', `${field} debe usar el formato HH:mm`, { field });
  return value;
};
export type ValidClassInput = Readonly<{
  name: string;
  danceTypeId: string;
  teacherId: string;
  level: string | null;
  capacity: number;
  schedules: readonly ClassScheduleInputDto[];
  status: 'ACTIVE' | 'INACTIVE';
}>;
export const validateClass = (
  input: CreateClassDto & { status?: 'ACTIVE' | 'INACTIVE' },
): ValidClassInput => {
  if (
    typeof input.capacity !== 'number' ||
    !Number.isInteger(input.capacity) ||
    input.capacity <= 0
  )
    throw new DomainError('VALIDATION_ERROR', 'El cupo debe ser un entero positivo', {
      field: 'capacity',
    });
  if (!Array.isArray(input.schedules) || input.schedules.length === 0)
    throw new DomainError('VALIDATION_ERROR', 'La clase debe tener al menos un horario', {
      field: 'schedules',
    });
  const schedules = input.schedules.map((schedule, index) => {
    if (!days.includes(schedule.dayOfWeek))
      throw new DomainError('VALIDATION_ERROR', 'Día de semana inválido', {
        field: `schedules.${index}.dayOfWeek`,
      });
    const startTime = time(schedule.startTime, `schedules.${index}.startTime`);
    const endTime = time(schedule.endTime, `schedules.${index}.endTime`);
    if (endTime <= startTime)
      throw new DomainError(
        'INVALID_SCHEDULE_TIME',
        'La hora de fin debe ser posterior a la hora de inicio',
        { field: `schedules.${index}.endTime` },
      );
    return {
      dayOfWeek: schedule.dayOfWeek,
      startTime,
      endTime,
      roomId: required(schedule.roomId, `schedules.${index}.roomId`, 36),
    };
  });
  for (let left = 0; left < schedules.length; left += 1)
    for (let right = left + 1; right < schedules.length; right += 1) {
      const a = schedules[left]!;
      const b = schedules[right]!;
      if (a.dayOfWeek === b.dayOfWeek && a.startTime < b.endTime && a.endTime > b.startTime)
        throw new DomainError(
          a.roomId === b.roomId ? 'ROOM_SCHEDULE_CONFLICT' : 'TEACHER_SCHEDULE_CONFLICT',
          a.roomId === b.roomId
            ? 'Los horarios de la clase se superponen en el mismo salón'
            : 'Los horarios de la clase se superponen para el profesor',
          { field: 'schedules' },
        );
    }
  return {
    name: required(input.name, 'name', 150),
    danceTypeId: required(input.danceTypeId, 'danceTypeId', 36),
    teacherId: required(input.teacherId, 'teacherId', 36),
    level: optional(input.level, 'level', 100),
    capacity: input.capacity,
    schedules,
    status: input.status ?? 'ACTIVE',
  };
};
