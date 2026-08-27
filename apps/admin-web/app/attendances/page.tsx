'use client';

import type {
  AttendanceDto,
  AttendanceQuickSearchDto,
  AttendanceRosterDto,
  AttendanceStatusDto,
  ClassListDto,
} from '@academy/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminShell } from '../../components/admin-shell';
import { RequirePermission } from '../../components/permission-gate';
import { apiRequest, ApiClientError } from '../../lib/api-client';
import { businessToday } from '../../lib/dates';

type AttendanceRow = {
  enrollmentId: string;
  studentName: string;
  attendanceId?: string;
  status: AttendanceStatusDto;
  notes: string;
};
type Mode = 'quick' | 'roster';

const statusLabel: Readonly<Record<AttendanceStatusDto, string>> = {
  PRESENT: 'Presente',
  ABSENT: 'Ausente',
  JUSTIFIED: 'Justificada',
};
const dayLabel: Readonly<Record<string, string>> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};
const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiClientError ? error.message : fallback;

export default function AttendancesPage() {
  const [mode, setMode] = useState<Mode>('quick');
  const [date, setDate] = useState(businessToday);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [query, setQuery] = useState('');
  const [quickResults, setQuickResults] = useState<AttendanceQuickSearchDto['items']>([]);
  const [quickSearched, setQuickSearched] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);
  const [savingEnrollmentId, setSavingEnrollmentId] = useState<string | null>(null);
  const searchSequence = useRef(0);

  const [classes, setClasses] = useState<ClassListDto['items']>([]);
  const [classId, setClassId] = useState('');
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [savingRoster, setSavingRoster] = useState(false);

  useEffect(() => {
    const loadClasses = async () => {
      try {
        const result = await apiRequest<ClassListDto>('/classes?status=ACTIVE&pageSize=100');
        setClasses(result.items);
      } catch (error) {
        setMessage(errorMessage(error, 'No se pudieron cargar las clases.'));
      } finally {
        setLoadingClasses(false);
      }
    };
    void loadClasses();
  }, []);

  const searchStudents = useCallback(async () => {
    const normalizedQuery = query.trim();
    const sequence = ++searchSequence.current;
    setQuickLoading(true);
    setMessage(null);
    setSuccess(false);
    try {
      const result = await apiRequest<AttendanceQuickSearchDto>(
        `/attendances/quick-search?q=${encodeURIComponent(normalizedQuery)}&date=${encodeURIComponent(date)}`,
      );
      if (sequence !== searchSequence.current) return;
      setQuickResults(result.items);
      setQuickSearched(true);
    } catch (error) {
      if (sequence !== searchSequence.current) return;
      setQuickResults([]);
      setQuickSearched(false);
      setMessage(errorMessage(error, 'No se pudo buscar el alumno.'));
    } finally {
      if (sequence === searchSequence.current) setQuickLoading(false);
    }
  }, [date, query]);

  useEffect(() => {
    if (mode !== 'quick') return;
    const timeout = window.setTimeout(() => void searchStudents(), 300);
    return () => window.clearTimeout(timeout);
  }, [mode, searchStudents]);

  const updateQuickAttendance = async (
    enrollmentId: string,
    attendance: AttendanceDto | null,
    status: AttendanceStatusDto,
  ) => {
    setSavingEnrollmentId(enrollmentId);
    setMessage(null);
    setSuccess(false);
    try {
      const saved = attendance
        ? await apiRequest<AttendanceDto>(`/attendances/${attendance.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
          })
        : await apiRequest<AttendanceDto>('/attendances', {
            method: 'POST',
            body: JSON.stringify({ enrollmentId, attendanceDate: date, status: 'PRESENT' }),
          });
      setQuickResults((students) =>
        students.map((student) => ({
          ...student,
          enrollments: student.enrollments.map((enrollment) =>
            enrollment.enrollmentId === enrollmentId
              ? { ...enrollment, attendance: saved }
              : enrollment,
          ),
        })),
      );
      setSuccess(true);
      setMessage(
        attendance
          ? `Asistencia corregida a ${statusLabel[status].toLowerCase()}.`
          : 'Presente registrada correctamente.',
      );
    } catch (error) {
      setMessage(errorMessage(error, 'No se pudo guardar la asistencia.'));
    } finally {
      setSavingEnrollmentId(null);
    }
  };

  const loadRoster = useCallback(async () => {
    if (!classId || !date) {
      setRows([]);
      return;
    }
    setLoadingRoster(true);
    setMessage(null);
    setSuccess(false);
    try {
      const result = await apiRequest<AttendanceRosterDto>(
        `/attendances/roster?classId=${encodeURIComponent(classId)}&date=${encodeURIComponent(date)}`,
      );
      setRows(
        result.items.map((item) => ({
          enrollmentId: item.enrollmentId,
          studentName: `${item.student.lastName}, ${item.student.firstName}`,
          ...(item.attendance ? { attendanceId: item.attendance.id } : {}),
          status: item.attendance?.status ?? 'PRESENT',
          notes: item.attendance?.notes ?? '',
        })),
      );
    } catch (error) {
      setRows([]);
      setMessage(errorMessage(error, 'No se pudo cargar el listado de asistencia.'));
    } finally {
      setLoadingRoster(false);
    }
  }, [classId, date]);

  useEffect(() => {
    if (mode === 'roster') void loadRoster();
  }, [loadRoster, mode]);

  const updateRow = (enrollmentId: string, change: Partial<AttendanceRow>) =>
    setRows((current) =>
      current.map((row) => (row.enrollmentId === enrollmentId ? { ...row, ...change } : row)),
    );

  async function saveRoster() {
    setSavingRoster(true);
    setMessage(null);
    setSuccess(false);
    try {
      await Promise.all(
        rows.map((row) =>
          row.attendanceId
            ? apiRequest<AttendanceDto>(`/attendances/${row.attendanceId}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: row.status, notes: row.notes || null }),
              })
            : apiRequest<AttendanceDto>('/attendances', {
                method: 'POST',
                body: JSON.stringify({
                  enrollmentId: row.enrollmentId,
                  attendanceDate: date,
                  status: row.status,
                  notes: row.notes || null,
                }),
              }),
        ),
      );
      await loadRoster();
      setSuccess(true);
      setMessage('Asistencias guardadas correctamente.');
    } catch (error) {
      setMessage(errorMessage(error, 'No se pudieron guardar las asistencias.'));
    } finally {
      setSavingRoster(false);
    }
  }

  return (
    <AdminShell>
      <RequirePermission permission="attendance:manage">
        <div className="attendance-page">
          <header className="attendance-header">
            <p className="attendance-eyebrow">Gestión de asistencias</p>
            <h1>Asistencias</h1>
          </header>

          <div className="attendance-tabs" role="tablist" aria-label="Modo de asistencia">
            <button
              type="button"
              className={mode === 'quick' ? '' : 'secondary'}
              aria-selected={mode === 'quick'}
              onClick={() => setMode('quick')}
            >
              Ingreso rápido
            </button>
            <button
              type="button"
              className={mode === 'roster' ? '' : 'secondary'}
              aria-selected={mode === 'roster'}
              onClick={() => setMode('roster')}
            >
              Pasar lista
            </button>
          </div>

          {mode === 'quick' ? (
            <>
              <div className="attendance-filters attendance-quick-filters">
                <label className="attendance-field">
                  Buscar alumno
                  <input
                    type="search"
                    value={query}
                    maxLength={100}
                    placeholder="Nombre, apellido o DNI"
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <label className="attendance-field">
                  Fecha
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </label>
                <div className="attendance-search-status" aria-live="polite">
                  {quickLoading ? 'Buscando...' : 'La lista se actualiza automáticamente.'}
                </div>
              </div>

              {quickSearched && quickResults.length === 0 && (
                <p className="attendance-empty">No se encontraron alumnos.</p>
              )}
              <div className="attendance-quick-results">
                {quickResults.map((item) => (
                  <section className="attendance-panel" key={item.student.id}>
                    <header className="attendance-student-header">
                      <h2>
                        {item.student.firstName} {item.student.lastName}
                      </h2>
                      <span>DNI {item.student.dni}</span>
                    </header>
                    {item.enrollments.length === 0 ? (
                      <p>El alumno no tiene clases asignadas para esta fecha.</p>
                    ) : (
                      <div className="attendance-class-list">
                        {item.enrollments.map((enrollment) => (
                          <article
                            className={`attendance-class-card ${enrollment.scheduledOnSelectedDay ? 'suggested' : ''}`}
                            key={enrollment.enrollmentId}
                          >
                            <div>
                              <h3>{enrollment.className}</h3>
                              <p>
                                Profesor: {enrollment.teacher.firstName}{' '}
                                {enrollment.teacher.lastName}
                              </p>
                              {enrollment.schedules.map((schedule) => (
                                <p key={schedule.id}>
                                  {dayLabel[schedule.dayOfWeek]} {schedule.startTime}–
                                  {schedule.endTime} · {schedule.roomName}
                                </p>
                              ))}
                              {enrollment.scheduledOnSelectedDay && (
                                <span className="attendance-suggestion">
                                  Horario del día seleccionado
                                </span>
                              )}
                            </div>
                            <div className="attendance-quick-action">
                              {enrollment.attendance ? (
                                <>
                                  <strong>
                                    Estado actual: {statusLabel[enrollment.attendance.status]}
                                  </strong>
                                  <select
                                    aria-label={`Corregir asistencia de ${enrollment.className}`}
                                    value={enrollment.attendance.status}
                                    disabled={savingEnrollmentId === enrollment.enrollmentId}
                                    onChange={(event) =>
                                      void updateQuickAttendance(
                                        enrollment.enrollmentId,
                                        enrollment.attendance,
                                        event.target.value as AttendanceStatusDto,
                                      )
                                    }
                                  >
                                    <option value="PRESENT">Presente</option>
                                    <option value="ABSENT">Ausente</option>
                                    <option value="JUSTIFIED">Justificada</option>
                                  </select>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  disabled={savingEnrollmentId === enrollment.enrollmentId}
                                  onClick={() =>
                                    void updateQuickAttendance(
                                      enrollment.enrollmentId,
                                      null,
                                      'PRESENT',
                                    )
                                  }
                                >
                                  {savingEnrollmentId === enrollment.enrollmentId
                                    ? 'Registrando...'
                                    : 'Registrar presente'}
                                </button>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </>
          ) : (
            <>
              <section className="attendance-filters">
                <label className="attendance-field">
                  Clase
                  <select
                    value={classId}
                    disabled={loadingClasses || savingRoster}
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
                <label className="attendance-field">
                  Fecha
                  <input
                    type="date"
                    value={date}
                    disabled={savingRoster}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </label>
              </section>

              {loadingRoster && <p>Cargando alumnos...</p>}
              {!loadingRoster && classId && rows.length === 0 && !message && (
                <p className="attendance-empty">
                  No hay alumnos vigentes en esta clase para la fecha.
                </p>
              )}
              {!loadingRoster && rows.length > 0 && (
                <section className="attendance-panel">
                  <div className="attendance-list">
                    {rows.map((row) => (
                      <article className="attendance-row" key={row.enrollmentId}>
                        <div className="attendance-student">
                          <strong>{row.studentName}</strong>
                        </div>
                        <label className="attendance-field">
                          Estado
                          <select
                            value={row.status}
                            disabled={savingRoster}
                            onChange={(event) =>
                              updateRow(row.enrollmentId, {
                                status: event.target.value as AttendanceStatusDto,
                              })
                            }
                          >
                            <option value="PRESENT">Presente</option>
                            <option value="ABSENT">Ausente</option>
                            <option value="JUSTIFIED">Justificada</option>
                          </select>
                        </label>
                        <label className="attendance-field attendance-notes">
                          Observación
                          <input
                            type="text"
                            maxLength={1000}
                            value={row.notes}
                            disabled={savingRoster}
                            onChange={(event) =>
                              updateRow(row.enrollmentId, { notes: event.target.value })
                            }
                          />
                        </label>
                      </article>
                    ))}
                  </div>
                  <div className="attendance-actions">
                    <button type="button" disabled={savingRoster} onClick={() => void saveRoster()}>
                      {savingRoster ? 'Guardando...' : 'Guardar asistencias'}
                    </button>
                  </div>
                </section>
              )}
            </>
          )}

          {message && (
            <p className="attendance-message" role={success ? 'status' : 'alert'}>
              {message}
            </p>
          )}
        </div>
      </RequirePermission>
    </AdminShell>
  );
}
