import { Prisma } from '@academy/database';

export const buildStudentSearchWhere = (query: string): Prisma.StudentWhereInput => {
  const q = query.trim();
  if (!q) return {};
  const terms = q.split(/\s+/).filter(Boolean);
  const digitQuery = /^[\d.\-\s()+]+$/.test(q) ? q.replace(/\D/g, '') : '';
  const mode = 'insensitive' as const;
  return {
    OR: [
      { firstName: { contains: q, mode } },
      { lastName: { contains: q, mode } },
      { phone: { contains: q, mode } },
      {
        AND: terms.map((term) => ({
          OR: [{ firstName: { contains: term, mode } }, { lastName: { contains: term, mode } }],
        })),
      },
      ...(digitQuery ? [{ dni: { contains: digitQuery } }] : []),
    ],
  };
};
