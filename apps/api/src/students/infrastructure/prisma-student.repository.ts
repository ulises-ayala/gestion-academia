import { Inject, Injectable } from '@nestjs/common';
import { Prisma, type Student } from '@academy/database';
import { PrismaService } from '../../database/prisma.service';
import { DomainError } from '../../shared/domain/domain-error';
import type { StudentData } from '../domain/student';
import type { StudentListQuery, StudentPage, StudentPersistenceInput, StudentRepository } from '../application/student.repository';

const toDomain = (student: Student): StudentData => ({
  ...student,
  status: student.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
});

@Injectable()
export class PrismaStudentRepository implements StudentRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: StudentPersistenceInput): Promise<StudentData> {
    try {
      return toDomain(await this.prisma.student.create({ data: input }));
    } catch (error) {
      this.translateUniqueError(error);
      throw error;
    }
  }

  async findPage(query: StudentListQuery): Promise<StudentPage> {
    const where = this.buildWhere(query);
    const [students, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.student.count({ where }),
    ]);
    return { items: students.map(toDomain), total, page: query.page, pageSize: query.pageSize };
  }

  async findById(id: string): Promise<StudentData | null> {
    const student = await this.prisma.student.findUnique({ where: { id } });
    return student ? toDomain(student) : null;
  }

  async findByDni(dni: string): Promise<StudentData | null> {
    const student = await this.prisma.student.findUnique({ where: { dni } });
    return student ? toDomain(student) : null;
  }

  async update(id: string, input: StudentPersistenceInput): Promise<StudentData> {
    try {
      return toDomain(await this.prisma.student.update({ where: { id }, data: input }));
    } catch (error) {
      this.translateUniqueError(error);
      throw error;
    }
  }

  private translateUniqueError(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new DomainError('DNI_ALREADY_EXISTS', 'Ya existe un alumno con ese DNI', { field: 'dni' });
    }
  }

  private buildWhere(query: StudentListQuery): Prisma.StudentWhereInput {
    const q = query.q?.trim();
    if (!q) return query.status ? { status: query.status } : {};
    const terms = q.split(/\s+/).filter(Boolean);
    const digitQuery = /^[\d.\-\s()+]+$/.test(q) ? q.replace(/\D/g, '') : '';
    const textMode = 'insensitive' as const;
    const search: Prisma.StudentWhereInput = {
      OR: [
        { firstName: { contains: q, mode: textMode } },
        { lastName: { contains: q, mode: textMode } },
        { phone: { contains: q, mode: textMode } },
        {
          AND: terms.map((term) => ({
            OR: [
              { firstName: { contains: term, mode: textMode } },
              { lastName: { contains: term, mode: textMode } },
            ],
          })),
        },
        ...(digitQuery ? [{ dni: { contains: digitQuery } }] : []),
      ],
    };
    return query.status ? { status: query.status, AND: [search] } : search;
  }
}
