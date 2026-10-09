import { describe, expect, it } from 'vitest';
import {
  defaultFollowUpFilters,
  followUpSearch,
  parseMinimumAbsences,
  readFollowUpSearch,
} from './student-follow-up-filters';

describe('Student follow-up filters', () => {
  it('uses 3 as the default minimum', () => {
    expect(defaultFollowUpFilters.minAbsences).toBe('3');
    expect(readFollowUpSearch('').filters.minAbsences).toBe('3');
  });

  it.each(['1', '6', '10'])('accepts the positive integer %s', (value) => {
    expect(parseMinimumAbsences(value)).toBe(Number(value));
  });

  it.each(['', '0', '-1', '1.5', 'abc', '999999999999999999999'])(
    'rejects the invalid minimum %s',
    (value) => {
      expect(parseMinimumAbsences(value)).toBeNull();
    },
  );

  it('persists the active filters and page in the URL', () => {
    expect(followUpSearch({ q: ' Ana Pérez ', classId: 'class-id', minAbsences: '6' }, 2)).toBe(
      'minAbsences=6&q=Ana+P%C3%A9rez&classId=class-id&page=2',
    );
    expect(readFollowUpSearch('?minAbsences=6&q=Ana+P%C3%A9rez&classId=class-id&page=2')).toEqual({
      filters: { q: 'Ana Pérez', classId: 'class-id', minAbsences: '6' },
      page: 2,
    });
  });
});
