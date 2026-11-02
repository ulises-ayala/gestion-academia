import type { ClassDto, DayOfWeekDto } from '@academy/contracts';
export const dayLabels: Record<DayOfWeekDto, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

/** Profesores de la clase: el responsable primero y después los adicionales. */
export const classTeachersLabel = (
  academicClass: Pick<ClassDto, 'teacher' | 'additionalTeachers'>,
) =>
  [academicClass.teacher, ...academicClass.additionalTeachers]
    .map((teacher) => `${teacher.firstName} ${teacher.lastName}`)
    .join(', ');
