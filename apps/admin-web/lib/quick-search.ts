import type { LeadDto, StudentDto } from '@academy/contracts';
import { leadPrimaryContact, leadStatusLabels } from './leads';
import { formatStudentName, formatStudentPhone } from './student-presentation';

export const QUICK_SEARCH_MIN_LENGTH = 2;
export const QUICK_SEARCH_LIMIT = 5;

export type QuickSearchItem = Readonly<{
  id: string;
  kind: 'section' | 'student' | 'lead';
  title: string;
  detail: string;
  href: string;
  muted?: boolean;
}>;

export type QuickSearchGroup = Readonly<{ label: string; items: readonly QuickSearchItem[] }>;
export type QuickSearchSection = Readonly<{ href: string; label: string }>;

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es-AR');

export const studentResult = (student: StudentDto): QuickSearchItem => ({
  id: `student-${student.id}`,
  kind: 'student',
  title: formatStudentName(student.lastName, student.firstName),
  detail: [
    `DNI ${student.dni}`,
    student.phone ? formatStudentPhone(student.phone) : null,
    student.status === 'INACTIVE' ? 'Inactivo' : null,
  ]
    .filter(Boolean)
    .join(' · '),
  href: `/students/${student.id}`,
  muted: student.status === 'INACTIVE',
});

export const leadResult = (lead: LeadDto): QuickSearchItem => ({
  id: `lead-${lead.id}`,
  kind: 'lead',
  title: lead.name,
  detail: [leadStatusLabels[lead.status], leadPrimaryContact(lead)].filter(Boolean).join(' · '),
  href: `/leads/${lead.id}`,
});

/**
 * Agrupa los resultados. Sin texto suficiente sólo ofrece las secciones del menú;
 * con texto, filtra secciones por nombre (sin distinguir acentos) y suma alumnos y potenciales.
 */
export const buildQuickSearchGroups = (
  query: string,
  sections: readonly QuickSearchSection[],
  students: readonly StudentDto[],
  leads: readonly LeadDto[],
): QuickSearchGroup[] => {
  const text = fold(query.trim());
  const sectionItems = sections
    .filter((section) => !text || fold(section.label).includes(text))
    .map<QuickSearchItem>((section) => ({
      id: `section-${section.href}`,
      kind: 'section',
      title: section.label,
      detail: 'Ir a la sección',
      href: section.href,
    }));
  if (text.length < QUICK_SEARCH_MIN_LENGTH)
    return sectionItems.length ? [{ label: 'Ir a', items: sectionItems }] : [];
  return [
    { label: 'Alumnos', items: students.slice(0, QUICK_SEARCH_LIMIT).map(studentResult) },
    { label: 'Potenciales', items: leads.slice(0, QUICK_SEARCH_LIMIT).map(leadResult) },
    { label: 'Secciones', items: sectionItems.slice(0, 3) },
  ].filter((group) => group.items.length > 0);
};

/** Mueve la selección con las flechas, volviendo al principio o al final. */
export const moveSelection = (current: number, delta: 1 | -1, total: number) =>
  total === 0 ? -1 : (current + delta + total) % total;
