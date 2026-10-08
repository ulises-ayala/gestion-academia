import type { StudentFollowUpItemDto, StudentFollowUpResponseDto } from '@academy/contracts';
import { Prisma } from '@academy/database';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FOLLOW_UP_MIN_ABSENCES } from '../domain/student-follow-up';
import { followUpColumns, followUpCte } from './student-follow-up-query';

export type FollowUpQuery = Readonly<{
  q: string;
  classId?: string;
  minAbsences: number;
  page: number;
  pageSize: number;
}>;

@Injectable()
export class PrismaStudentFollowUpReader {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: FollowUpQuery): Promise<StudentFollowUpResponseDto> {
    const terms = query.q.split(/\s+/).filter(Boolean);
    const digits = /^[\d.\-\s()+]+$/.test(query.q) ? query.q.replace(/\D/g, '') : '';
    const nameMatch = terms.length
      ? Prisma.join(
          terms.map(
            (term) => Prisma.sql`
      (strpos(lower(first_name), lower(${term})) > 0 OR strpos(lower(last_name), lower(${term})) > 0)
    `,
          ),
          ' AND ',
        )
      : Prisma.sql`TRUE`;
    const [result] = await this.prisma.$queryRaw<
      {
        items: StudentFollowUpItemDto[];
        total: bigint;
        students: bigint;
        globalTotal: bigint;
        classes: { id: string; name: string }[];
      }[]
    >(Prisma.sql`
      ${followUpCte()}, eligible AS (
        SELECT * FROM cases WHERE "consecutiveAbsences" >= ${FOLLOW_UP_MIN_ABSENCES}
      ), filtered AS (
        SELECT * FROM eligible WHERE "consecutiveAbsences" >= ${query.minAbsences}
        ${query.classId ? Prisma.sql`AND "classId" = ${query.classId}::uuid` : Prisma.empty}
        AND ((${nameMatch}) ${digits ? Prisma.sql`OR strpos("studentDni", ${digits}) > 0` : Prisma.empty})
      ), page_items AS (
        SELECT ${followUpColumns} FROM filtered
        ORDER BY "consecutiveAbsences" DESC, "lastAttendanceRecordAt" ASC NULLS LAST, "enrollmentId"
        LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}
      )
      SELECT (SELECT COUNT(*) FROM filtered) AS total,
        (SELECT COUNT(DISTINCT "studentId") FROM filtered) AS students,
        (SELECT COUNT(*) FROM eligible) AS "globalTotal",
        COALESCE((SELECT jsonb_agg(p) FROM page_items p), '[]'::jsonb) AS items,
        COALESCE((SELECT jsonb_agg(c ORDER BY c.name, c.id) FROM (
          SELECT DISTINCT "classId" AS id, "className" AS name FROM eligible
        ) c), '[]'::jsonb) AS classes
    `);
    return {
      items: result!.items,
      total: Number(result!.total),
      students: Number(result!.students),
      globalTotal: Number(result!.globalTotal),
      classes: result!.classes,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  forStudent(studentId: string): Promise<StudentFollowUpItemDto[]> {
    return this.prisma.$queryRaw(Prisma.sql`
      ${followUpCte(studentId)} SELECT ${followUpColumns} FROM cases
      ORDER BY "className", "enrollmentId"
    `);
  }
}
