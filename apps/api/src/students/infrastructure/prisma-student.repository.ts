import { Inject, Injectable } from '@nestjs/common';
import { Prisma, type Student } from '@academy/database';
import { PrismaService } from '../../database/prisma.service';
import { DomainError } from '../../shared/domain/domain-error';
import type { StudentData } from '../domain/student';
import type { StudentPersistenceInput, StudentRepository } from '../application/student.repository';

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

  async findAll(status?: 'ACTIVE' | 'INACTIVE'): Promise<StudentData[]> {
    const students = await this.prisma.student.findMany({
      ...(status ? { where: { status } } : {}),
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return students.map(toDomain);
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
}
