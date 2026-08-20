import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@academy/database';
import { PrismaService } from '../../database/prisma.service';
import { DomainError } from '../../shared/domain/domain-error';
import type { ClassData, ClassQuery, ClassRepository } from '../application/class.repository';
import type { ValidClassInput } from '../domain/academic-class';

const atTime = (value: string) => new Date(`1970-01-01T${value}:00.000Z`);
const fromTime = (value: Date) => value.toISOString().slice(11, 16);
const include = { danceType: { select: { id: true, name: true } }, teacher: { select: { id: true, firstName: true, lastName: true } }, schedules: { where: { status: 'ACTIVE' as const }, include: { room: { select: { id: true, name: true, branch: { select: { id: true, name: true } } } } }, orderBy: [{ dayOfWeek: 'asc' as const }, { startTime: 'asc' as const }] } };
type IncludedClass = Prisma.AcademyClassGetPayload<{ include: typeof include }>;
const mapClass = (item: IncludedClass): ClassData => ({ id: item.id, name: item.name, level: item.level, capacity: item.capacity, status: item.status, danceType: item.danceType, teacher: item.teacher, schedules: item.schedules.map((schedule) => ({ id: schedule.id, dayOfWeek: schedule.dayOfWeek, startTime: fromTime(schedule.startTime), endTime: fromTime(schedule.endTime), room: schedule.room })), createdAt: item.createdAt, updatedAt: item.updatedAt });

@Injectable()
export class PrismaClassRepository implements ClassRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async findById(id: string) { const item = await this.prisma.academyClass.findUnique({ where: { id }, include }); return item ? mapClass(item) : null; }
  findTeacher(id: string) { return this.prisma.teacher.findUnique({ where: { id }, select: { status: true } }); }
  findDanceType(id: string) { return this.prisma.danceType.findUnique({ where: { id }, select: { status: true } }); }
  async findRooms(ids: readonly string[]) { const rooms = await this.prisma.room.findMany({ where: { id: { in: [...ids] } }, select: { id: true, status: true, branch: { select: { status: true } } } }); return rooms.map((room) => ({ id: room.id, status: room.status, branchStatus: room.branch.status })); }
  create(data: ValidClassInput) { return this.write(undefined, data); }
  update(id: string, data: ValidClassInput) { return this.write(id, data); }
  async findPage(query: ClassQuery) {
    const where: Prisma.AcademyClassWhereInput = { ...(query.status ? { status: query.status } : {}), ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}), ...(query.danceTypeId ? { danceTypeId: query.danceTypeId } : {}), ...(query.teacherId ? { teacherId: query.teacherId } : {}), ...(query.branchId ? { schedules: { some: { status: 'ACTIVE', room: { branchId: query.branchId } } } } : {}) };
    const [items, total] = await this.prisma.$transaction([this.prisma.academyClass.findMany({ where, include, orderBy: { name: 'asc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), this.prisma.academyClass.count({ where })]);
    return { items: items.map(mapClass), total, page: query.page, pageSize: query.pageSize };
  }
  private async write(id: string | undefined, data: ValidClassInput): Promise<ClassData> {
    return this.prisma.$transaction(async (tx) => {
      if (data.status === 'ACTIVE') await this.assertNoConflicts(tx, id, data);
      const classData = { name: data.name, danceTypeId: data.danceTypeId, teacherId: data.teacherId, level: data.level, capacity: data.capacity, status: data.status };
      let classId = id;
      if (id) { await tx.academyClass.update({ where: { id }, data: classData }); await tx.classSchedule.updateMany({ where: { classId: id, status: 'ACTIVE' }, data: { status: 'INACTIVE' } }); }
      else { classId = (await tx.academyClass.create({ data: classData })).id; }
      if (!classId) throw new Error('No se pudo resolver el identificador de la clase');
      await tx.classSchedule.createMany({ data: data.schedules.map((schedule) => ({ classId, dayOfWeek: schedule.dayOfWeek, startTime: atTime(schedule.startTime), endTime: atTime(schedule.endTime), roomId: schedule.roomId })) });
      const saved = await tx.academyClass.findUniqueOrThrow({ where: { id: classId }, include }); return mapClass(saved);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  private async assertNoConflicts(tx: Prisma.TransactionClient, classId: string | undefined, data: ValidClassInput) {
    const intervalConditions = data.schedules.map((schedule) => ({ dayOfWeek: schedule.dayOfWeek, startTime: { lt: atTime(schedule.endTime) }, endTime: { gt: atTime(schedule.startTime) } }));
    const base = { status: 'ACTIVE' as const, class: { status: 'ACTIVE' as const, ...(classId ? { id: { not: classId } } : {}) } };
    const roomConflict = await tx.classSchedule.findFirst({ where: { ...base, OR: data.schedules.map((schedule) => ({ roomId: schedule.roomId, dayOfWeek: schedule.dayOfWeek, startTime: { lt: atTime(schedule.endTime) }, endTime: { gt: atTime(schedule.startTime) } })) }, select: { id: true } });
    if (roomConflict) throw new DomainError('ROOM_SCHEDULE_CONFLICT', 'El salón ya está ocupado en parte de ese horario', { field: 'schedules' });
    const teacherConflict = await tx.classSchedule.findFirst({ where: { ...base, class: { ...base.class, teacherId: data.teacherId }, OR: intervalConditions }, select: { id: true } });
    if (teacherConflict) throw new DomainError('TEACHER_SCHEDULE_CONFLICT', 'El profesor ya tiene otra clase en parte de ese horario', { field: 'schedules' });
  }
}
