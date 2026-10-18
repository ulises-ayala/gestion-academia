import type { OperationalDashboardDto } from '@academy/contracts';
import { dashboardContextLinks } from './contextual-filters';

export const BUSINESS_TIME_ZONE = 'America/Buenos_Aires';
/** Una clase que empieza dentro de esta ventana pasa a ser la tarea de "Ahora". */
export const UPCOMING_CLASS_WINDOW_MINUTES = 60;

export type TodayClass = NonNullable<OperationalDashboardDto['classes']>['today'][number];
export type ClassAttendanceState = 'complete' | 'partial' | 'pending' | 'no-students' | 'unknown';

export const classAttendanceState = (item: TodayClass): ClassAttendanceState => {
  if (item.attendanceRecords === null) return 'unknown';
  if (item.enrolledStudents === 0) return 'no-students';
  if (item.attendanceRecords >= item.enrolledStudents) return 'complete';
  return item.attendanceRecords > 0 ? 'partial' : 'pending';
};

const needsAttendance = (item: TodayClass) => {
  const state = classAttendanceState(item);
  return state === 'pending' || state === 'partial';
};

/** Hora operativa "HH:MM" para comparar con los horarios de clase. */
export const businessClock = (now: Date, timeZone = BUSINESS_TIME_ZONE) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);

const minutes = (clock: string) => {
  const [hours = 0, mins = 0] = clock.split(':').map(Number);
  return hours * 60 + mins;
};

export type AlertKey = 'student-follow-up' | 'overdue-charges' | 'overdue-leads';
export type DashboardAlert = Readonly<{
  key: AlertKey;
  count: number;
  title: string;
  description: string;
  href: string;
  action: string;
}>;

const plural = (count: number, singular: string, pluralForm: string) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

export const dashboardAlerts = (
  data: OperationalDashboardDto,
  can: (permission: 'students:manage' | 'payments:read' | 'leads:manage') => boolean,
): DashboardAlert[] => {
  const alerts: DashboardAlert[] = [];
  const followUp = data.followUp?.students ?? 0;
  if (followUp > 0 && can('students:manage'))
    alerts.push({
      key: 'student-follow-up',
      count: followUp,
      title: `${plural(followUp, 'alumno', 'alumnos')} con 3 o más ausencias`,
      description: 'Ausencias consecutivas en una inscripción activa.',
      href: '/students/follow-up',
      action: 'Ver seguimientos',
    });
  const overdue = data.billing?.overdueCharges ?? 0;
  if (overdue > 0) {
    const students = data.billing?.overdueStudents ?? 0;
    alerts.push({
      key: 'overdue-charges',
      count: overdue,
      title: plural(overdue, 'cuota vencida', 'cuotas vencidas'),
      description:
        students > 0
          ? `Corresponden a ${plural(students, 'alumno', 'alumnos')}.`
          : 'Cuotas con saldo pendiente y vencimiento anterior a hoy.',
      href: dashboardContextLinks.overdueCharges,
      action: 'Ver cuotas vencidas',
    });
  }
  const leads = data.leads?.overdueFollowUps ?? 0;
  if (leads > 0)
    alerts.push({
      key: 'overdue-leads',
      count: leads,
      title: plural(leads, 'seguimiento comercial atrasado', 'seguimientos comerciales atrasados'),
      description: 'Potenciales alumnos con el próximo contacto vencido.',
      href: dashboardContextLinks.overdueFollowUps,
      action: 'Ver potenciales',
    });
  return alerts;
};

export type NowFocus =
  | Readonly<{
      kind: 'class';
      item: TodayClass;
      phase: 'in-progress' | 'upcoming' | 'missed' | 'later';
    }>
  | Readonly<{ kind: 'alert'; alert: DashboardAlert }>
  | Readonly<{ kind: 'clear' }>;

/**
 * Elige una única prioridad para recepción:
 * 1. clase en curso o que empieza dentro de la ventana, con asistencia sin completar;
 * 2. clase de hoy ya terminada con asistencia sin completar;
 * 3. la primera alerta (seguimiento de alumnos, cuotas vencidas, potenciales atrasados);
 * 4. la próxima clase del día, aunque falte más tiempo;
 * 5. todo al día.
 */
export const nowFocus = (
  classes: readonly TodayClass[],
  alerts: readonly DashboardAlert[],
  clock: string,
): NowFocus => {
  const now = minutes(clock);
  const active = classes.find(
    (item) =>
      needsAttendance(item) &&
      minutes(item.endTime) > now &&
      minutes(item.startTime) - now <= UPCOMING_CLASS_WINDOW_MINUTES,
  );
  if (active)
    return {
      kind: 'class',
      item: active,
      phase: minutes(active.startTime) <= now ? 'in-progress' : 'upcoming',
    };
  const missed = classes.find((item) => needsAttendance(item) && minutes(item.endTime) <= now);
  if (missed) return { kind: 'class', item: missed, phase: 'missed' };
  if (alerts[0]) return { kind: 'alert', alert: alerts[0] };
  const later = classes.find((item) => minutes(item.startTime) > now);
  if (later) return { kind: 'class', item: later, phase: 'later' };
  return { kind: 'clear' };
};

/** "2026-10-16" → "Viernes 16 de octubre". */
export const longBusinessDate = (businessDate: string) => {
  const text = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
    .format(new Date(`${businessDate}T12:00:00Z`))
    .replace(',', '');
  return `${text.charAt(0).toLocaleUpperCase('es-AR')}${text.slice(1)}`;
};

const businessDay = (instant: string, timeZone = BUSINESS_TIME_ZONE) =>
  new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(instant));

const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

/** Etiqueta corta del próximo contacto de un potencial. */
export const followUpWhen = (nextFollowUpAt: string, overdue: boolean, businessDate: string) => {
  if (overdue) return 'Vencido';
  const day = businessDay(nextFollowUpAt);
  if (day === businessDate) return 'Hoy';
  if (day === addDays(businessDate, 1)) return 'Mañana';
  return day.split('-').reverse().slice(0, 2).join('/');
};

export const personInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase('es-AR'))
    .join('') || '?';
