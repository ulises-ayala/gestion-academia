import { DayOfWeek } from '@prisma/client';

type Schedule = Readonly<{
  classIndex: number;
  dayOfWeek: DayOfWeek;
  startHour: number;
  endHour: number;
}>;
type Enrollment = Readonly<{
  studentIndex: number;
  classIndex: number;
  startOffset: number;
  endOffset: number | null;
}>;

export type SeedDatasetSnapshot = Readonly<{
  studentDnis: readonly string[];
  classCapacities: readonly number[];
  schedules: readonly Schedule[];
  enrollments: readonly Enrollment[];
  attendances: readonly Readonly<{ enrollmentIndex: number; dateOffset: number }>[];
  charges: readonly Readonly<{ enrollmentIndex: number; period: string }>[];
}>;

const periodsOverlap = (left: Enrollment, right: Enrollment) =>
  (left.endOffset === null || right.startOffset <= left.endOffset) &&
  (right.endOffset === null || left.startOffset <= right.endOffset);

export const validateSeedDataset = (dataset: SeedDatasetSnapshot) => {
  if (new Set(dataset.studentDnis).size !== dataset.studentDnis.length)
    throw new Error('Dataset inválido: existen DNI de alumnos duplicados.');

  for (const schedule of dataset.schedules)
    if (schedule.startHour >= schedule.endHour || !dataset.classCapacities[schedule.classIndex])
      throw new Error('Dataset inválido: existe una clase u horario inválido.');

  for (const [index, enrollment] of dataset.enrollments.entries()) {
    const duplicates = dataset.enrollments
      .slice(index + 1)
      .filter(
        (other) =>
          other.studentIndex === enrollment.studentIndex &&
          other.classIndex === enrollment.classIndex &&
          periodsOverlap(enrollment, other),
      );
    if (duplicates.length)
      throw new Error('Dataset inválido: existen inscripciones coexistentes duplicadas.');

    const ownSchedules = dataset.schedules.filter(
      (item) => item.classIndex === enrollment.classIndex,
    );
    for (const other of dataset.enrollments.slice(index + 1)) {
      if (other.studentIndex !== enrollment.studentIndex || !periodsOverlap(enrollment, other))
        continue;
      const otherSchedules = dataset.schedules.filter(
        (item) => item.classIndex === other.classIndex,
      );
      if (
        ownSchedules.some((left) =>
          otherSchedules.some(
            (right) =>
              left.dayOfWeek === right.dayOfWeek &&
              left.startHour < right.endHour &&
              right.startHour < left.endHour,
          ),
        )
      )
        throw new Error(
          'Dataset inválido: un alumno tiene inscripciones con horarios superpuestos.',
        );
    }
  }

  for (const [classIndex, capacity] of dataset.classCapacities.entries()) {
    const active = dataset.enrollments.filter(
      (item) => item.classIndex === classIndex && item.endOffset === null,
    ).length;
    if (active > capacity) throw new Error('Dataset inválido: una clase excede su cupo.');
  }

  const attendanceKeys = new Set<string>();
  for (const attendance of dataset.attendances) {
    const enrollment = dataset.enrollments[attendance.enrollmentIndex];
    if (
      !enrollment ||
      attendance.dateOffset < enrollment.startOffset ||
      (enrollment.endOffset !== null && attendance.dateOffset > enrollment.endOffset)
    )
      throw new Error('Dataset inválido: existe asistencia fuera de vigencia.');
    const key = `${attendance.enrollmentIndex}:${attendance.dateOffset}`;
    if (attendanceKeys.has(key)) throw new Error('Dataset inválido: existe asistencia duplicada.');
    attendanceKeys.add(key);
  }

  const chargeKeys = new Set<string>();
  for (const charge of dataset.charges) {
    const key = `${charge.enrollmentIndex}:${charge.period}`;
    if (chargeKeys.has(key)) throw new Error('Dataset inválido: existe cuota mensual duplicada.');
    chargeKeys.add(key);
  }
};
