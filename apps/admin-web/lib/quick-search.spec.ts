import type { LeadDto, StudentDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import { buildQuickSearchGroups, moveSelection } from './quick-search';

const sections = [
  { href: '/', label: 'Inicio' },
  { href: '/students', label: 'Alumnos' },
  { href: '/payments', label: 'Pagos' },
  { href: '/classes/agenda', label: 'Agenda' },
];

const student = (overrides: Partial<StudentDto> = {}): StudentDto => ({
  id: 's1',
  dni: '30111222',
  firstName: 'Ana',
  lastName: 'Pérez',
  birthDate: null,
  phone: '+5491100000000',
  email: null,
  address: null,
  joinedAt: '2026-08-28',
  status: 'ACTIVE',
  createdAt: '2026-08-28T00:00:00Z',
  updatedAt: '2026-08-28T00:00:00Z',
  ...overrides,
});

const lead: LeadDto = {
  id: 'l1',
  name: 'Lucía Martínez',
  phone: '+5491122223333',
  email: null,
  instagram: null,
  source: 'INSTAGRAM',
  status: 'INQUIRY',
  notes: null,
  nextFollowUpAt: null,
  lastContactAt: null,
  createdAt: '2026-08-28T00:00:00Z',
  updatedAt: '2026-08-28T00:00:00Z',
};

describe('buildQuickSearchGroups', () => {
  it('offers every section when there is no query', () => {
    expect(buildQuickSearchGroups('', sections, [], [])).toEqual([
      {
        label: 'Ir a',
        items: expect.arrayContaining([expect.objectContaining({ title: 'Pagos' })]),
      },
    ]);
  });

  it('filters sections ignoring accents and case', () => {
    const [group] = buildQuickSearchGroups('a', sections, [], []);
    expect(group?.items.map((item) => item.title)).toEqual(['Alumnos', 'Pagos', 'Agenda']);
    const [only] = buildQuickSearchGroups('PÁGOS', sections, [], []);
    expect(only?.items.map((item) => item.title)).toEqual(['Pagos']);
  });

  it('groups students, leads and matching sections once the query is long enough', () => {
    const groups = buildQuickSearchGroups(
      'ago',
      sections,
      [student(), student({ id: 's2', status: 'INACTIVE', firstName: 'Ana' })],
      [lead],
    );
    expect(groups.map((group) => group.label)).toEqual(['Alumnos', 'Potenciales', 'Secciones']);
    expect(groups[0]?.items[0]).toMatchObject({ href: '/students/s1', title: 'Pérez, Ana' });
    expect(groups[0]?.items[1]).toMatchObject({ muted: true });
    expect(groups[0]?.items[1]?.detail).toContain('Inactivo');
    expect(groups[1]?.items[0]).toMatchObject({ href: '/leads/l1', title: 'Lucía Martínez' });
  });

  it('drops empty groups', () => {
    expect(buildQuickSearchGroups('zzz', sections, [], [])).toEqual([]);
  });
});

describe('moveSelection', () => {
  it('wraps around the list', () => {
    expect(moveSelection(0, 1, 3)).toBe(1);
    expect(moveSelection(2, 1, 3)).toBe(0);
    expect(moveSelection(0, -1, 3)).toBe(2);
    expect(moveSelection(-1, 1, 0)).toBe(-1);
  });
});
