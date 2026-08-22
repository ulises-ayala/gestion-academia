'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '../../components/admin-shell';

import type {
  AttendanceDto,
  AttendanceListDto,
  AttendanceStatusDto,
  ClassListDto,
  EnrollmentListDto,
} from '@academy/contracts';

import { apiRequest } from '../../lib/api-client';

type AttendanceRow = {
  enrollmentId: string;
  studentName: string;
  attendanceId?: string;
  status: AttendanceStatusDto;
  notes: string;
};

export default function AttendancesPage() {
  const [classes, setClasses] = useState<ClassListDto['items']>([]);
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState('2026-08-21');

  const [enrollments, setEnrollments] =
    useState<EnrollmentListDto['items']>([]);

  const [attendances, setAttendances] =
    useState<AttendanceDto[]>([]);

  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadClasses() {
      const result = await apiRequest<ClassListDto>(
        '/classes?status=ACTIVE&pageSize=100',
      );

      setClasses([...result.items]);
    }

    void loadClasses();
  }, []);

  useEffect(() => {
    if (!classId || !date) {
      setEnrollments([]);
      setAttendances([]);
      setRows([]);
      return;
    }

    async function loadAttendanceData() {
      setLoading(true);
      setMessage(null);

      try {
        const [enrollmentResult, attendanceResult] =
          await Promise.all([
            apiRequest<EnrollmentListDto>(
              `/enrollments?classId=${classId}&status=ACTIVE&pageSize=100`,
            ),
            apiRequest<AttendanceListDto>(
              `/attendances?classId=${classId}&date=${date}`,
            ),
          ]);

        setEnrollments([...enrollmentResult.items]);
        setAttendances([...attendanceResult.items]);
        const newRows: AttendanceRow[] =
        enrollmentResult.items.map((enrollment) => {
            const existingAttendance =
            attendanceResult.items.find(
                (attendance) =>
                attendance.enrollmentId === enrollment.id,
            );

            return {
            enrollmentId: enrollment.id,
            studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
            ...(existingAttendance
                ? { attendanceId: existingAttendance.id }
                : {}),
            status: existingAttendance?.status ?? 'PRESENT',
            notes: existingAttendance?.notes ?? '',
            };
        });

        setRows(newRows);
      } catch {
        setMessage('No se pudieron cargar las asistencias.');
      } finally {
        setLoading(false);
      }
    }

    void loadAttendanceData();
  }, [classId, date]);

  async function saveAttendances() {
  setLoading(true);
  setMessage(null);

  try {
    const savedAttendances = await Promise.all(
      rows.map(async (row) => {
        if (row.attendanceId) {
          return apiRequest<AttendanceDto>(
            `/attendances/${row.attendanceId}`,
            {
              method: 'PATCH',
              body: JSON.stringify({
                status: row.status,
                notes: row.notes || null,
              }),
            },
          );
        }

        return apiRequest<AttendanceDto>(
          '/attendances',
          {
            method: 'POST',
            body: JSON.stringify({
              enrollmentId: row.enrollmentId,
              attendanceDate: date,
              status: row.status,
              notes: row.notes || null,
            }),
          },
        );
      }),
    );

    setRows(
      rows.map((row) => {
        const saved = savedAttendances.find(
          (attendance) =>
            attendance.enrollmentId === row.enrollmentId,
        );

        return saved
          ? {
              ...row,
              attendanceId: saved.id,
              status: saved.status,
              notes: saved.notes ?? '',
            }
          : row;
      }),
    );

    setMessage('Asistencias guardadas correctamente.');
  } catch {
    setMessage('No se pudieron guardar las asistencias.');
  } finally {
    setLoading(false);
  }
}
  return (
    <AdminShell>
    <div className="attendance-page">
      <header>
        <p>GESTIÓN DE ASISTENCIAS</p>
        <h1>Tomar asistencia</h1>
      </header>

      <section>
        <label>
          Clase
          <select
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
          >
            <option value="">Seleccionar clase</option>

            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Fecha
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
      </section>

      {loading && <p>Cargando...</p>}

      {message && <p>{message}</p>}

      {!loading && classId && rows.length === 0 && (
        <p>No hay alumnos inscriptos en esta clase.</p>
      )}

      {rows.length > 0 && (
        <section>
          {rows.map((row) => (
            <article key={row.enrollmentId}>
              <strong>{row.studentName}</strong>

              <select
                value={row.status}
                onChange={(event) => {
                    const status =
                    event.target.value as AttendanceStatusDto;

                    setRows((current) =>
                    current.map((item) =>
                        item.enrollmentId === row.enrollmentId
                        ? { ...item, status }
                        : item,
                    ),
                    );
                }}
                >
                <option value="PRESENT">Presente</option>
                <option value="ABSENT">Ausente</option>
                <option value="JUSTIFIED">Justificada</option>
              </select>

              <input
                type="text"
                value={row.notes}
                placeholder="Observaciones"
                onChange={(event) => {
                    const notes = event.target.value;

                    setRows((current) =>
                    current.map((item) =>
                        item.enrollmentId === row.enrollmentId
                        ? { ...item, notes }
                        : item,
                    ),
                    );
                }}
                />
            </article>
          ))}
          <button
            type="button"
            onClick={() => void saveAttendances()}
            disabled={loading}
            >
            {loading ? 'Guardando...' : 'Guardar asistencias'}
            </button>
        </section>
      )}
    </div>
    </AdminShell>
  );
}