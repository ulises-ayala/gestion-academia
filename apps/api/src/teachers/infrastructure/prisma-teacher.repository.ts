import { Inject, Injectable } from '@nestjs/common';
import { Prisma, type Teacher } from '@academy/database';
import { PrismaService } from '../../database/prisma.service';
import { DomainError } from '../../shared/domain/domain-error';
import type { TeacherData } from '../domain/teacher';
import type {
  TeacherQuery,
  TeacherRepository,
  TeacherWrite,
} from '../application/teacher.repository';
const map = (value: Teacher): TeacherData => ({ ...value, status: value.status });
@Injectable()
export class PrismaTeacherRepository implements TeacherRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async create(data: TeacherWrite) {
    try {
      return map(await this.prisma.teacher.create({ data }));
    } catch (error) {
      this.unique(error);
      throw error;
    }
  }
  async update(id: string, data: TeacherWrite) {
    try {
      return map(await this.prisma.teacher.update({ where: { id }, data }));
    } catch (error) {
      this.unique(error);
      throw error;
    }
  }
  async findById(id: string) {
    const value = await this.prisma.teacher.findUnique({ where: { id } });
    return value ? map(value) : null;
  }
  async findByDni(dni: string) {
    const value = await this.prisma.teacher.findUnique({ where: { dni } });
    return value ? map(value) : null;
  }
  async hasActiveClasses(id: string) {
    return (
      (await this.prisma.academyClass.count({ where: { teacherId: id, status: 'ACTIVE' } })) > 0
    );
  }
  async findPage(query: TeacherQuery) {
    const q = query.q?.trim();
    const digits = q && /^[\d.\-\s()+]+$/.test(q) ? q.replace(/\D/g, '') : '';
    const terms = q?.split(/\s+/).filter(Boolean) ?? [];
    const search: Prisma.TeacherWhereInput | undefined = q
      ? {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
            {
              AND: terms.map((term) => ({
                OR: [
                  { firstName: { contains: term, mode: 'insensitive' } },
                  { lastName: { contains: term, mode: 'insensitive' } },
                ],
              })),
            },
            ...(digits ? [{ dni: { contains: digits } }] : []),
          ],
        }
      : undefined;
    const where: Prisma.TeacherWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(search ? { AND: [search] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.teacher.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.teacher.count({ where }),
    ]);
    return { items: items.map(map), total, page: query.page, pageSize: query.pageSize };
  }
  private unique(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw new DomainError('DNI_ALREADY_EXISTS', 'Ya existe un profesor con ese DNI', {
        field: 'dni',
      });
  }
}
