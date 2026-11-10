import type {
  MessageSituationDto,
  MessageVariableDto,
  SaveMessageTemplateDto,
} from '@academy/contracts';
import { DomainError } from '../../shared/domain/domain-error';

const name: MessageVariableDto = { key: 'nombre', label: 'nombre' };
const className: MessageVariableDto = { key: 'clase', label: 'clase' };

/** Las situaciones, en el orden del menú, con los datos que cada una puede completar. */
export const SITUATIONS: readonly Readonly<{
  situation: MessageSituationDto;
  group: string;
  label: string;
  description: string;
  variables: readonly MessageVariableDto[];
}>[] = [
  {
    situation: 'CHARGE_DUE_SOON',
    group: 'Pagos',
    label: 'Cuota por vencer',
    description: 'Alumnos con una cuota que vence en los próximos 5 días.',
    variables: [
      name,
      { key: 'cuotas', label: 'cuotas' },
      { key: 'saldo', label: 'saldo' },
      { key: 'vencimiento', label: 'vencimiento' },
    ],
  },
  {
    situation: 'CHARGE_OVERDUE',
    group: 'Pagos',
    label: 'Cuota vencida',
    description: 'Alumnos con al menos una cuota vencida hoy.',
    variables: [
      name,
      { key: 'cuotas', label: 'cuotas' },
      { key: 'saldo_vencido', label: 'saldo vencido' },
      { key: 'vencimiento', label: 'vencimiento' },
      { key: 'saldo_total', label: 'saldo total' },
    ],
  },
  {
    situation: 'ABSENCES',
    group: 'Asistencia',
    label: 'Faltó varias veces',
    description: 'Alumnos con 3 o más ausencias seguidas en una clase.',
    variables: [name, className, { key: 'ausencias', label: 'ausencias' }],
  },
  {
    situation: 'DROPPED',
    group: 'Asistencia',
    label: 'Dejó hace poco',
    description: 'Alumnos cuya última inscripción terminó en los últimos 60 días.',
    variables: [name, className],
  },
  {
    situation: 'WELCOME',
    group: 'Comunidad',
    label: 'Bienvenida',
    description: 'Alumnos que empezaron en los últimos 30 días.',
    variables: [name, className],
  },
  {
    situation: 'BIRTHDAY',
    group: 'Comunidad',
    label: 'Cumpleaños',
    description: 'Alumnos activos que cumplen años hoy o en los próximos 7 días.',
    variables: [name],
  },
  {
    situation: 'LEAD_NO_TRIAL',
    group: 'Potenciales',
    label: 'Consultó y no vino',
    description: 'Potenciales alumnos que consultaron y todavía no hicieron la clase de prueba.',
    variables: [name],
  },
  {
    situation: 'LEAD_TRIAL_NOT_ENROLLED',
    group: 'Potenciales',
    label: 'Probó y no se inscribió',
    description: 'Potenciales alumnos que hicieron la clase de prueba y no se inscribieron.',
    variables: [name, className],
  },
];

export const parseSituation = (value: unknown): MessageSituationDto => {
  const found = SITUATIONS.find((item) => item.situation === value);
  if (!found)
    throw new DomainError('VALIDATION_ERROR', 'La situación no es válida', { field: 'situation' });
  return found.situation;
};

/** Los datos entre llaves que usa un mensaje, sin repetir. */
export const templateVariables = (body: string) => [
  ...new Set([...body.matchAll(/\{([^{}\s]+)\}/g)].map((match) => match[1]!)),
];

/**
 * Nombre y texto de un mensaje. Solo puede usar los datos de su situación: uno desconocido
 * llegaría al alumno como "{algo}".
 */
export const validateTemplate = (
  input: SaveMessageTemplateDto,
  situation: MessageSituationDto,
): Readonly<{ name: string; body: string }> => {
  const templateName = typeof input.name === 'string' ? input.name.trim() : '';
  if (!templateName || templateName.length > 80)
    throw new DomainError('VALIDATION_ERROR', 'Poné un nombre de hasta 80 caracteres', {
      field: 'name',
    });
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (!body || body.length > 2000)
    throw new DomainError('VALIDATION_ERROR', 'Escribí un mensaje de hasta 2000 caracteres', {
      field: 'body',
    });
  const allowed = SITUATIONS.find((item) => item.situation === situation)!.variables.map(
    (item) => item.key,
  );
  const unknown = templateVariables(body).filter((key) => !allowed.includes(key));
  if (unknown.length)
    throw new DomainError(
      'VALIDATION_ERROR',
      `Este mensaje no puede usar ${unknown.map((key) => `{${key}}`).join(', ')}. Datos disponibles: ${allowed.map((key) => `{${key}}`).join(', ')}.`,
      { field: 'body' },
    );
  return { name: templateName, body };
};

const DAY = 86_400_000;
const time = (date: string) => Date.parse(`${date}T00:00:00.000Z`);

export const addDays = (date: string, days: number) =>
  new Date(time(date) + days * DAY).toISOString().slice(0, 10);

/** Días que faltan para el próximo cumpleaños (0 = hoy). El 29/02 se festeja el 28 en años comunes. */
export const daysUntilBirthday = (birthDate: string, today: string) => {
  const year = Number(today.slice(0, 4));
  const next = (targetYear: number) => {
    const month = Number(birthDate.slice(5, 7));
    const day = Number(birthDate.slice(8, 10));
    const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
    return Date.UTC(targetYear, month - 1, Math.min(day, lastDay));
  };
  const thisYear = next(year);
  return Math.round(((thisYear >= time(today) ? thisYear : next(year + 1)) - time(today)) / DAY);
};

/** "1 cuota" / "3 cuotas". */
export const chargesLabel = (count: number) => (count === 1 ? '1 cuota' : `${count} cuotas`);

/** AAAA-MM-DD → DD/MM. */
export const shortDate = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
