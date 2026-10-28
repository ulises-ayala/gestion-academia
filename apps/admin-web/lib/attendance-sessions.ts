import type { AttendanceDto, AttendanceQuickSearchDto } from '@academy/contracts';

type QuickSearchItems = AttendanceQuickSearchDto['items'];

/** Clave del botón de presente: cada horario del día tiene el suyo. */
export const attendanceSlotKey = (enrollmentId: string, scheduleId: string | null) =>
  `${enrollmentId}:${scheduleId ?? 'fuera-de-horario'}`;

/** La planilla es de un horario: dos turnos de la misma clase tienen planillas distintas. */
export const rosterPath = (classId: string, scheduleId: string, date: string) =>
  `/attendances/roster?classId=${encodeURIComponent(classId)}&scheduleId=${encodeURIComponent(scheduleId)}&date=${encodeURIComponent(date)}`;

/** Pone la asistencia recién guardada en su horario (o fuera de horario) sin tocar los demás. */
export const withSavedAttendance = (
  items: QuickSearchItems,
  saved: AttendanceDto,
): QuickSearchItems =>
  items.map((student) => ({
    ...student,
    enrollments: student.enrollments.map((enrollment) => {
      if (enrollment.enrollmentId !== saved.enrollmentId) return enrollment;
      if (saved.scheduleId === null) return { ...enrollment, attendance: saved };
      return {
        ...enrollment,
        daySessions: enrollment.daySessions.map((session) =>
          session.scheduleId === saved.scheduleId ? { ...session, attendance: saved } : session,
        ),
      };
    }),
  }));
