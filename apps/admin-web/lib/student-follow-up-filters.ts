export const defaultFollowUpMinimumAbsences = 3;
const maxMinimumAbsences = 2_147_483_647;

export type FollowUpFilters = Readonly<{
  q: string;
  classId: string;
  minAbsences: string;
}>;

export const defaultFollowUpFilters: FollowUpFilters = {
  q: '',
  classId: '',
  minAbsences: String(defaultFollowUpMinimumAbsences),
};

export function parseMinimumAbsences(value: string | null): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maxMinimumAbsences ? parsed : null;
}

export function readFollowUpSearch(
  search: string,
): Readonly<{ filters: FollowUpFilters; page: number }> {
  const params = new URLSearchParams(search);
  const minAbsences = parseMinimumAbsences(params.get('minAbsences'));
  const page = parseMinimumAbsences(params.get('page')) ?? 1;
  return {
    filters: {
      q: params.get('q') ?? '',
      classId: params.get('classId') ?? '',
      minAbsences: String(minAbsences ?? defaultFollowUpMinimumAbsences),
    },
    page,
  };
}

export function followUpSearch(filters: FollowUpFilters, page: number): string {
  const params = new URLSearchParams({
    minAbsences: String(
      parseMinimumAbsences(filters.minAbsences) ?? defaultFollowUpMinimumAbsences,
    ),
  });
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.classId) params.set('classId', filters.classId);
  if (page > 1) params.set('page', String(page));
  return params.toString();
}
