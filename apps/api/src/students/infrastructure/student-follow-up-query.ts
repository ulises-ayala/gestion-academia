import { Prisma } from '@academy/database';
import { FOLLOW_UP_MIN_ABSENCES } from '../domain/student-follow-up';

// Attendance identity is enrollment + date. Never infer attendance from schedules.
// Running non-ABSENT count is zero only inside the CURRENT trailing absent streak.
export function followUpCte(studentId?: string) {
  return Prisma.sql`
    WITH active AS (
      SELECT id, student_id, class_id, start_date FROM enrollments
      WHERE status = 'ACTIVE'
      ${studentId ? Prisma.sql`AND student_id = ${studentId}::uuid` : Prisma.empty}
    ), ranked AS (
      SELECT a.enrollment_id, a.attendance_date, a.status,
        ROW_NUMBER() OVER w AS position,
        COUNT(*) FILTER (WHERE a.status <> 'ABSENT') OVER w AS breaks
      FROM student_attendances a JOIN active e ON e.id = a.enrollment_id
      WINDOW w AS (PARTITION BY a.enrollment_id ORDER BY a.attendance_date DESC
                   ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
    ), streaks AS (
      SELECT enrollment_id,
        COUNT(*) FILTER (WHERE status = 'ABSENT' AND breaks = 0)::int AS absences,
        MAX(attendance_date) FILTER (WHERE status = 'PRESENT') AS last_present,
        MAX(attendance_date) AS last_record,
        MAX(status::text) FILTER (WHERE position = 1) AS last_status
      FROM ranked GROUP BY enrollment_id
    ), cases AS (
      SELECT e.id AS "enrollmentId", e.student_id AS "studentId", e.class_id AS "classId",
        e.start_date::text AS "startDate", s.first_name || ' ' || s.last_name AS "studentName",
        s.first_name, s.last_name, s.dni AS "studentDni", c.name AS "className",
        t.first_name || ' ' || t.last_name AS "teacherName",
        COALESCE(a.absences, 0) AS "consecutiveAbsences",
        a.last_present::text AS "lastPresentAt", a.last_record::text AS "lastAttendanceRecordAt",
        a.last_status AS "lastAttendanceStatus"
      FROM active e JOIN students s ON s.id = e.student_id
      JOIN classes c ON c.id = e.class_id JOIN teachers t ON t.id = c.teacher_id
      LEFT JOIN streaks a ON a.enrollment_id = e.id
    )`;
}

export const followUpColumns = Prisma.sql`
  "studentId", "studentName", "studentDni", "enrollmentId", "startDate",
  "classId", "className", "teacherName", "consecutiveAbsences",
  "lastPresentAt", "lastAttendanceRecordAt", "lastAttendanceStatus"`;

export const followUpCountQuery = () => Prisma.sql`
  ${followUpCte()}
  SELECT COUNT(DISTINCT "studentId") AS students FROM cases
  WHERE "consecutiveAbsences" >= ${FOLLOW_UP_MIN_ABSENCES}`;
