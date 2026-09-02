'use client';

import type {
  AttendanceDayClassDto,
  AttendanceDayDto,
  AttendanceDto,
  AttendanceQuickSearchDto,
  AttendanceRosterDto,
  AttendanceStatusDto,
  SaveAttendanceRosterResultDto,
} from '@academy/contracts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminShell } from '../../components/admin-shell';
import { RequirePermission } from '../../components/permission-gate';
import { apiRequest, ApiClientError } from '../../lib/api-client';
import { businessToday } from '../../lib/dates';
import { attendanceDateFromSearch } from '../../lib/contextual-filters';

type AttendanceRow = {
  enrollmentId: string;
  studentName: string;
  dni: string;
  status: AttendanceStatusDto;
  notes: string;
};

const statusLabel: Readonly<Record<AttendanceStatusDto, string>> = {
  PRESENT: 'Presente',
  ABSENT: 'Ausente',
  JUSTIFIED: 'Justificada',
};
const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiClientError ? error.message : fallback;
const displayDate = (value: string) =>
  new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
const selectedDayOfWeek = (value: string) =>
  ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][
    new Date(`${value}T00:00:00.000Z`).getUTCDay()
  ];

export default function AttendancesPage() {
  const [date, setDate] = useState(() =>
    attendanceDateFromSearch(
      typeof window === 'undefined' ? '' : window.location.search,
      businessToday(),
    ),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [dayClasses, setDayClasses] = useState<AttendanceDayClassDto[]>([]);
  const [loadingDay, setLoadingDay] = useState(true);
  const [query, setQuery] = useState('');
  const [searchOutsideDay, setSearchOutsideDay] = useState(false);
  const [quickResults, setQuickResults] = useState<AttendanceQuickSearchDto['items']>([]);
  const [quickLoading, setQuickLoading] = useState(false);
  const [savingEnrollmentId, setSavingEnrollmentId] = useState<string | null>(null);
  const searchSequence = useRef(0);
  const [selectedClass, setSelectedClass] = useState<AttendanceDayClassDto | null>(null);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [rosterFilter, setRosterFilter] = useState('');
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [savingRoster, setSavingRoster] = useState(false);
  const changeDate = (nextDate: string) => {
    setDate(nextDate);
    const url = new URL(window.location.href);
    url.searchParams.set('date', nextDate);
    window.history.pushState({}, '', url);
  };

  const loadDay = useCallback(async () => {
    setLoadingDay(true);
    try {
      const result = await apiRequest<AttendanceDayDto>(
        `/attendances/day?date=${encodeURIComponent(date)}`,
      );
      setDayClasses([...result.items]);
    } catch (error) {
      setDayClasses([]);
      setMessage(errorMessage(error, 'No se pudieron cargar las clases del día.'));
    } finally {
      setLoadingDay(false);
    }
  }, [date]);

  useEffect(() => {
    setSelectedClass(null);
    setRows([]);
    setRosterFilter('');
    setMessage(null);
    void loadDay();
  }, [loadDay]);

  useEffect(() => {
    const onPopState = () =>
      setDate(attendanceDateFromSearch(window.location.search, businessToday()));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const normalizedQuery = query.trim();
    const sequence = ++searchSequence.current;
    if (!normalizedQuery) {
      setQuickResults([]);
      setQuickLoading(false);
      return;
    }
    setQuickLoading(true);
    const timeout = window.setTimeout(async () => {
      try {
        const result = await apiRequest<AttendanceQuickSearchDto>(
          `/attendances/quick-search?q=${encodeURIComponent(normalizedQuery)}&date=${encodeURIComponent(date)}&includeOtherDays=${searchOutsideDay}`,
        );
        if (sequence === searchSequence.current) setQuickResults(result.items);
      } catch (error) {
        if (sequence === searchSequence.current) {
          setQuickResults([]);
          setMessage(errorMessage(error, 'No se pudo buscar el alumno.'));
        }
      } finally {
        if (sequence === searchSequence.current) setQuickLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [date, query, searchOutsideDay]);

  const updateQuickAttendance = async (enrollmentId: string, attendance: AttendanceDto | null) => {
    setSavingEnrollmentId(enrollmentId);
    setMessage(null);
    setSuccess(false);
    try {
      const saved = attendance
        ? await apiRequest<AttendanceDto>(`/attendances/${attendance.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'PRESENT' }),
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
      await loadDay();
      setSuccess(true);
      setMessage('Presente registrada correctamente.');
    } catch (error) {
      setMessage(errorMessage(error, 'No se pudo guardar la asistencia.'));
    } finally {
      setSavingEnrollmentId(null);
    }
  };

  const loadRoster = useCallback(
    async (dayClass: AttendanceDayClassDto) => {
      setSelectedClass(dayClass);
      setRosterFilter('');
      setLoadingRoster(true);
      setMessage(null);
      try {
        const result = await apiRequest<AttendanceRosterDto>(
          `/attendances/roster?classId=${encodeURIComponent(dayClass.classId)}&date=${encodeURIComponent(date)}`,
        );
        setRows(
          result.items.map((item) => ({
            enrollmentId: item.enrollmentId,
            studentName: `${item.student.firstName} ${item.student.lastName}`,
            dni: item.student.dni,
            status: item.attendance?.status ?? 'ABSENT',
            notes: item.attendance?.notes ?? '',
          })),
        );
      } catch (error) {
        setRows([]);
        setMessage(errorMessage(error, 'No se pudo cargar el listado de asistencia.'));
      } finally {
        setLoadingRoster(false);
      }
    },
    [date],
  );

  const updateRow = (enrollmentId: string, status: AttendanceStatusDto) =>
    setRows((current) =>
      current.map((row) => (row.enrollmentId === enrollmentId ? { ...row, status } : row)),
    );

  async function saveRoster() {
    if (!selectedClass) return;
    setSavingRoster(true);
    setMessage(null);
    setSuccess(false);
    try {
      await apiRequest<SaveAttendanceRosterResultDto>('/attendances/roster', {
        method: 'PUT',
        body: JSON.stringify({
          classId: selectedClass.classId,
          date,
          attendances: rows.map(({ enrollmentId, status, notes }) => ({
            enrollmentId,
            status,
            notes: notes || null,
          })),
        }),
      });
      await Promise.all([loadRoster(selectedClass), loadDay()]);
      setSuccess(true);
      setMessage('Lista guardada correctamente.');
    } catch (error) {
      setMessage(errorMessage(error, 'No se pudo guardar la lista.'));
    } finally {
      setSavingRoster(false);
    }
  }

  const counts = useMemo(
    () => ({
      PRESENT: rows.filter((row) => row.status === 'PRESENT').length,
      ABSENT: rows.filter((row) => row.status === 'ABSENT').length,
      JUSTIFIED: rows.filter((row) => row.status === 'JUSTIFIED').length,
    }),
    [rows],
  );
  const visibleRows = useMemo(() => {
    const filter = rosterFilter.trim().toLocaleLowerCase('es');
    if (!filter) return rows;
    const digits = filter.replace(/\D/g, '');
    return rows.filter(
      (row) =>
        row.studentName.toLocaleLowerCase('es').includes(filter) ||
        (digits.length > 0 && row.dni.replace(/\D/g, '').includes(digits)),
    );
  }, [rosterFilter, rows]);

  return (
    <AdminShell>
      <RequirePermission permission="attendance:manage">
        <div className="attendance-page">
          <header className="attendance-header">
            <p className="attendance-eyebrow">Gestión de asistencias</p>
            <h1>Asistencias</h1>
            <p className="attendance-date-title">{displayDate(date)}</p>
          </header>
          <section className="attendance-filters attendance-quick-filters">
            <label className="attendance-field">
              Buscar alumno de este día
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
                onChange={(event) => changeDate(event.target.value)}
              />
            </label>
            <div className="attendance-search-status" aria-live="polite">
              {quickLoading ? 'Buscando...' : 'La búsqueda se actualiza automáticamente.'}
            </div>
          </section>

          {query.trim() && (
            <section className="attendance-search-section">
              <div className="attendance-section-heading">
                <h2>Resultados</h2>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setSearchOutsideDay((current) => !current)}
                >
                  {searchOutsideDay
                    ? 'Buscar solo en clases de este día'
                    : 'Buscar fuera de este día'}
                </button>
              </div>
              {!quickLoading && quickResults.length === 0 && (
                <p className="attendance-empty">No se encontraron alumnos en este alcance.</p>
              )}
              <div className="attendance-quick-results">
                {quickResults.map((item) => {
                  const enrollments = searchOutsideDay
                    ? item.enrollments
                    : item.enrollments.filter((enrollment) => enrollment.scheduledOnSelectedDay);
                  return (
                    <section className="attendance-panel" key={item.student.id}>
                      <header className="attendance-student-header">
                        <h2>
                          {item.student.firstName} {item.student.lastName}
                        </h2>
                        <span>DNI {item.student.dni}</span>
                      </header>
                      <div className="attendance-class-list">
                        {enrollments.map((enrollment) => (
                          <article
                            className={`attendance-class-card ${enrollment.scheduledOnSelectedDay ? 'suggested' : ''}`}
                            key={enrollment.enrollmentId}
                          >
                            <div>
                              <h3>{enrollment.className}</h3>
                              <p>
                                Prof. {enrollment.teacher.firstName} {enrollment.teacher.lastName}
                              </p>
                              {enrollment.schedules
                                .filter(
                                  (schedule) =>
                                    searchOutsideDay ||
                                    schedule.dayOfWeek === selectedDayOfWeek(date),
                                )
                                .map((schedule) => (
                                  <p key={schedule.id}>
                                    {schedule.startTime}–{schedule.endTime} · {schedule.roomName}
                                  </p>
                                ))}
                            </div>
                            <div className="attendance-quick-action">
                              {enrollment.attendance?.status === 'PRESENT' ? (
                                <strong className="attendance-status present">Presente</strong>
                              ) : (
                                <button
                                  type="button"
                                  disabled={savingEnrollmentId === enrollment.enrollmentId}
                                  onClick={() =>
                                    void updateQuickAttendance(
                                      enrollment.enrollmentId,
                                      enrollment.attendance,
                                    )
                                  }
                                >
                                  {savingEnrollmentId === enrollment.enrollmentId
                                    ? 'Registrando...'
                                    : '✓ Registrar presente'}
                                </button>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </section>
          )}

          {!query.trim() && !selectedClass && (
            <section>
              <div className="attendance-section-heading">
                <h2>Clases del día</h2>
              </div>
              {loadingDay && <p>Cargando clases...</p>}
              {!loadingDay && dayClasses.length === 0 && (
                <p className="attendance-empty">No hay clases programadas para este día.</p>
              )}
              <div className="attendance-day-list">
                {dayClasses.map((dayClass) => (
                  <article
                    className="attendance-day-card"
                    key={`${dayClass.classId}-${dayClass.startTime}-${dayClass.room.id}`}
                  >
                    <time>{dayClass.startTime}</time>
                    <div>
                      <h3>{dayClass.className}</h3>
                      <p>
                        {dayClass.danceType} · Prof. {dayClass.teacher.firstName}{' '}
                        {dayClass.teacher.lastName}
                      </p>
                      <p>
                        {dayClass.room.name} · {dayClass.branch.name} · {dayClass.startTime}–
                        {dayClass.endTime}
                      </p>
                      <strong>
                        {dayClass.enrolledCount} alumnos · {dayClass.presentCount} presentes
                      </strong>
                    </div>
                    <button type="button" onClick={() => void loadRoster(dayClass)}>
                      Pasar lista
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {selectedClass && (
            <section className="attendance-panel attendance-roster-panel">
              <button type="button" className="secondary" onClick={() => setSelectedClass(null)}>
                ← Volver a clases del día
              </button>
              <div className="attendance-roster-heading">
                <div>
                  <h2>{selectedClass.className}</h2>
                  <p>
                    {selectedClass.startTime}–{selectedClass.endTime} · Prof.{' '}
                    {selectedClass.teacher.firstName} {selectedClass.teacher.lastName}
                  </p>
                </div>
                <div className="attendance-summary">
                  <span>
                    Inscritos <strong>{rows.length}</strong>
                  </span>
                  <span>
                    Presentes <strong>{counts.PRESENT}</strong>
                  </span>
                  <span>
                    Ausentes <strong>{counts.ABSENT}</strong>
                  </span>
                  <span>
                    Justificados <strong>{counts.JUSTIFIED}</strong>
                  </span>
                </div>
              </div>
              <label className="attendance-field attendance-roster-search">
                Buscar dentro de esta clase
                <input
                  type="search"
                  value={rosterFilter}
                  placeholder="Nombre o DNI"
                  onChange={(event) => setRosterFilter(event.target.value)}
                />
              </label>
              {loadingRoster && <p>Cargando alumnos...</p>}
              {!loadingRoster && rows.length === 0 && (
                <p className="attendance-empty">
                  No hay alumnos vigentes en esta clase para la fecha.
                </p>
              )}
              <div className="attendance-list">
                {visibleRows.map((row) => (
                  <article className="attendance-row attendance-toggle-row" key={row.enrollmentId}>
                    <div className="attendance-student">
                      <div>
                        <strong>{row.studentName}</strong>
                        <small>DNI {row.dni}</small>
                      </div>
                    </div>
                    <strong className={`attendance-status ${row.status.toLowerCase()}`}>
                      {statusLabel[row.status]}
                    </strong>
                    <div className="attendance-row-actions">
                      <button
                        type="button"
                        className={row.status === 'PRESENT' ? 'secondary' : ''}
                        disabled={savingRoster}
                        onClick={() =>
                          updateRow(
                            row.enrollmentId,
                            row.status === 'PRESENT' ? 'ABSENT' : 'PRESENT',
                          )
                        }
                      >
                        {row.status === 'PRESENT' ? 'Desmarcar' : '✓ Presente'}
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={savingRoster}
                        onClick={() =>
                          updateRow(
                            row.enrollmentId,
                            row.status === 'JUSTIFIED' ? 'ABSENT' : 'JUSTIFIED',
                          )
                        }
                      >
                        {row.status === 'JUSTIFIED' ? 'Quitar justificación' : 'Justificar'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {rows.length > 0 && (
                <div className="attendance-actions">
                  <button type="button" disabled={savingRoster} onClick={() => void saveRoster()}>
                    {savingRoster ? 'Guardando...' : 'Guardar lista'}
                  </button>
                </div>
              )}
            </section>
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
