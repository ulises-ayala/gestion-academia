'use client';
import type {
  BranchDto,
  ClassListDto,
  DanceTypeDto,
  StudentDto,
  TeacherListDto,
} from '@academy/contracts';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiClientError, apiRequest } from '../../../../../lib/api-client';
import { dayLabels } from '../../../../../lib/offering';
export default function NewEnrollmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [student, setStudent] = useState<StudentDto | null>(null);
  const [classes, setClasses] = useState<ClassListDto['items']>([]);
  const [filters, setFilters] = useState({ q: '', danceTypeId: '', teacherId: '', branchId: '' });
  const [options, setOptions] = useState<{
    dances: DanceTypeDto[];
    teachers: TeacherListDto['items'];
    branches: BranchDto[];
  }>({ dances: [], teachers: [], branches: [] });
  const [startDate, setStartDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const query = new URLSearchParams({ status: 'ACTIVE', pageSize: '100' });
    Object.entries(filters).forEach(([key, value]) => value && query.set(key, value));
    setClasses((await apiRequest<ClassListDto>(`/classes?${query}`)).items);
  }, [filters]);
  useEffect(() => {
    void Promise.all([
      apiRequest<StudentDto>(`/students/${id}`),
      apiRequest<DanceTypeDto[]>('/dance-types?status=ACTIVE'),
      apiRequest<TeacherListDto>('/teachers?status=ACTIVE&pageSize=100'),
      apiRequest<BranchDto[]>('/branches?status=ACTIVE'),
    ]).then(([s, d, t, b]) => {
      setStudent(s);
      setOptions({ dances: [...d], teachers: t.items, branches: [...b] });
    });
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  async function enroll(classId: string) {
    try {
      await apiRequest('/enrollments', {
        method: 'POST',
        body: JSON.stringify({ studentId: id, classId, startDate }),
      });
      router.push(`/students/${id}`);
    } catch (error) {
      if (error instanceof ApiClientError && error.error.code === 'ENROLLMENT_SCHEDULE_CONFLICT') {
        const details = error.error.details;
        const className = typeof details?.className === 'string' ? details.className : null;
        const dayOfWeek = typeof details?.dayOfWeek === 'string' ? details.dayOfWeek : null;
        const startTime = typeof details?.startTime === 'string' ? details.startTime : null;
        const endTime = typeof details?.endTime === 'string' ? details.endTime : null;
        if (className && dayOfWeek && startTime && endTime) {
          setMessage(
            `No se puede inscribir a esta clase porque se superpone con ${className} · ${dayLabels[dayOfWeek as keyof typeof dayLabels]} ${startTime}–${endTime}.`,
          );
          return;
        }
      }
      setMessage(
        error instanceof ApiClientError ? error.message : 'No se pudo crear la inscripción',
      );
    }
  }
  return (
    <>
      <Link className="back-link" href={`/students/${id}`}>
        ← Volver a la ficha
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Nueva inscripción</p>
          <h1>{student ? `${student.firstName} ${student.lastName}` : 'Alumno'}</h1>
        </div>
        <label>
          Inscripto desde
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
      </div>
      {message && <p className="message">{message}</p>}
      <section className="card">
        <div className="class-filters">
          <label>
            Nombre
            <input
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
          </label>
          <label>
            Danza
            <select
              value={filters.danceTypeId}
              onChange={(e) => setFilters({ ...filters, danceTypeId: e.target.value })}
            >
              <option value="">Todas</option>
              {options.dances.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Profesor
            <select
              value={filters.teacherId}
              onChange={(e) => setFilters({ ...filters, teacherId: e.target.value })}
            >
              <option value="">Todos</option>
              {options.teachers.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.firstName} {x.lastName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sucursal
            <select
              value={filters.branchId}
              onChange={(e) => setFilters({ ...filters, branchId: e.target.value })}
            >
              <option value="">Todas</option>
              {options.branches.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="enrollment-grid">
          {classes.map((item) => {
            const used = item.activeEnrollmentCount ?? 0;
            const full = used >= item.capacity;
            return (
              <article className="enrollment-card" key={item.id}>
                <h3>{item.name}</h3>
                <p>
                  {item.danceType.name} · {item.teacher.firstName} {item.teacher.lastName}
                </p>
                <ul className="schedule-list">
                  {item.schedules.map((s) => (
                    <li key={s.id}>
                      {dayLabels[s.dayOfWeek]} {s.startTime}–{s.endTime}
                      <br />
                      {s.room.branch.name} · {s.room.name}
                    </li>
                  ))}
                </ul>
                <p>
                  <strong>
                    {used} / {item.capacity}
                  </strong>{' '}
                  alumnos
                </p>
                <button disabled={full} onClick={() => void enroll(item.id)}>
                  {full ? 'Cupo completo' : 'Inscribir'}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
