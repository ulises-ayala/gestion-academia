import { beforeEach, describe, expect, it } from 'vitest';
import { DomainError } from '../../shared/domain/domain-error';
import type { ClassData, ClassQuery, ClassRepository } from './class.repository';
import { ClassesService } from './classes.service';
import type { ValidClassInput } from '../domain/academic-class';

class MemoryClasses implements ClassRepository {
  teachers = new Map<string, 'ACTIVE' | 'INACTIVE'>();
  danceTypes = new Map<string, 'ACTIVE' | 'INACTIVE'>();
  rooms = new Map<
    string,
    { status: 'ACTIVE' | 'INACTIVE'; branchStatus: 'ACTIVE' | 'INACTIVE'; name: string }
  >();
  items: ClassData[] = [];
  enrollmentCounts = new Map<string, { active: number; ended: number }>();
  async findById(id: string) {
    return this.items.find((item) => item.id === id) ?? null;
  }
  async findTeacher(id: string) {
    const status = this.teachers.get(id);
    return status ? { status } : null;
  }
  async findDanceType(id: string) {
    const status = this.danceTypes.get(id);
    return status ? { status } : null;
  }
  async findRooms(ids: readonly string[]) {
    return ids.flatMap((id) => {
      const room = this.rooms.get(id);
      return room ? [{ id, status: room.status, branchStatus: room.branchStatus }] : [];
    });
  }
  async create(data: ValidClassInput) {
    this.conflicts(undefined, data);
    return this.save(crypto.randomUUID(), data);
  }
  async update(id: string, data: ValidClassInput, validateCapacity = false) {
    const activeEnrollmentCount = this.enrollmentCounts.get(id)?.active ?? 0;
    if (validateCapacity && data.capacity < activeEnrollmentCount) {
      throw new DomainError(
        'CLASS_CAPACITY_BELOW_ENROLLMENT_COUNT',
        'No se puede establecer un cupo menor a la cantidad de alumnos inscriptos.',
        { activeEnrollmentCount, requestedCapacity: data.capacity },
      );
    }
    this.conflicts(id, data);
    return this.save(id, data);
  }
  async findPage(query: ClassQuery) {
    const items = this.items.filter((item) => !query.status || item.status === query.status);
    return { items, total: items.length, page: query.page, pageSize: query.pageSize };
  }
  private save(id: string, data: ValidClassInput): ClassData {
    const now = new Date();
    const item: ClassData = {
      id,
      name: data.name,
      level: data.level,
      capacity: data.capacity,
      status: data.status,
      danceType: { id: data.danceTypeId, name: 'Bachata' },
      teacher: { id: data.teacherId, firstName: 'Ana', lastName: 'Pérez' },
      schedules: data.schedules.map((schedule) => ({
        id: crypto.randomUUID(),
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        room: {
          id: schedule.roomId,
          name: this.rooms.get(schedule.roomId)?.name ?? 'Salón',
          branch: { id: crypto.randomUUID(), name: 'Centro' },
        },
      })),
      createdAt: now,
      updatedAt: now,
    };
    const index = this.items.findIndex((existing) => existing.id === id);
    if (index >= 0) this.items[index] = item;
    else this.items.push(item);
    return item;
  }
  private conflicts(excludedId: string | undefined, data: ValidClassInput) {
    for (const existing of this.items.filter(
      (item) => item.id !== excludedId && item.status === 'ACTIVE',
    ))
      for (const current of data.schedules)
        for (const old of existing.schedules)
          if (
            current.dayOfWeek === old.dayOfWeek &&
            current.startTime < old.endTime &&
            current.endTime > old.startTime
          ) {
            if (current.roomId === old.room.id)
              throw new DomainError('ROOM_SCHEDULE_CONFLICT', 'Salón ocupado');
            if (data.teacherId === existing.teacher.id)
              throw new DomainError('TEACHER_SCHEDULE_CONFLICT', 'Profesor ocupado');
          }
  }
}

describe('ClassesService', () => {
  let repo: MemoryClasses;
  let service: ClassesService;
  let teacherId: string;
  let danceTypeId: string;
  let roomId: string;
  const input = () => ({
    name: 'Bachata Inicial',
    teacherId,
    danceTypeId,
    capacity: 20,
    schedules: [{ dayOfWeek: 'TUESDAY' as const, startTime: '20:00', endTime: '21:00', roomId }],
  });
  beforeEach(() => {
    repo = new MemoryClasses();
    service = new ClassesService(repo);
    teacherId = crypto.randomUUID();
    danceTypeId = crypto.randomUUID();
    roomId = crypto.randomUUID();
    repo.teachers.set(teacherId, 'ACTIVE');
    repo.danceTypes.set(danceTypeId, 'ACTIVE');
    repo.rooms.set(roomId, { status: 'ACTIVE', branchStatus: 'ACTIVE', name: 'Salón 1' });
  });
  it('crea clase válida con múltiples horarios', async () => {
    const otherRoom = crypto.randomUUID();
    repo.rooms.set(otherRoom, { status: 'ACTIVE', branchStatus: 'ACTIVE', name: 'Salón 2' });
    await expect(
      service.create({
        ...input(),
        schedules: [
          ...input().schedules,
          { dayOfWeek: 'THURSDAY', startTime: '20:00', endTime: '21:00', roomId: otherRoom },
        ],
      }),
    ).resolves.toMatchObject({ schedules: [{}, {}] });
  });
  it('rechaza profesor inexistente o inactivo', async () => {
    repo.teachers.delete(teacherId);
    await expect(service.create(input())).rejects.toMatchObject({ code: 'TEACHER_NOT_FOUND' });
    repo.teachers.set(teacherId, 'INACTIVE');
    await expect(service.create(input())).rejects.toMatchObject({ code: 'TEACHER_INACTIVE' });
  });
  it('rechaza tipo de danza inexistente o inactivo', async () => {
    repo.danceTypes.delete(danceTypeId);
    await expect(service.create(input())).rejects.toMatchObject({ code: 'DANCE_TYPE_NOT_FOUND' });
    repo.danceTypes.set(danceTypeId, 'INACTIVE');
    await expect(service.create(input())).rejects.toMatchObject({ code: 'DANCE_TYPE_INACTIVE' });
  });
  it('rechaza salón inexistente o inactivo', async () => {
    repo.rooms.delete(roomId);
    await expect(service.create(input())).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' });
    repo.rooms.set(roomId, { status: 'INACTIVE', branchStatus: 'ACTIVE', name: 'Salón' });
    await expect(service.create(input())).rejects.toMatchObject({ code: 'ROOM_INACTIVE' });
  });
  it('detecta conflicto de salón', async () => {
    await service.create(input());
    const otherTeacher = crypto.randomUUID();
    repo.teachers.set(otherTeacher, 'ACTIVE');
    await expect(
      service.create({
        ...input(),
        teacherId: otherTeacher,
        schedules: [{ ...input().schedules[0]!, startTime: '20:30', endTime: '21:30' }],
      }),
    ).rejects.toMatchObject({ code: 'ROOM_SCHEDULE_CONFLICT' });
  });
  it('detecta conflicto de profesor en otro salón', async () => {
    await service.create(input());
    const otherRoom = crypto.randomUUID();
    repo.rooms.set(otherRoom, { status: 'ACTIVE', branchStatus: 'ACTIVE', name: 'Otro' });
    await expect(
      service.create({
        ...input(),
        schedules: [
          { ...input().schedules[0]!, roomId: otherRoom, startTime: '20:30', endTime: '21:30' },
        ],
      }),
    ).rejects.toMatchObject({ code: 'TEACHER_SCHEDULE_CONFLICT' });
  });
  it('permite horarios contiguos', async () => {
    await service.create(input());
    await expect(
      service.create({
        ...input(),
        schedules: [{ ...input().schedules[0]!, startTime: '21:00', endTime: '22:00' }],
      }),
    ).resolves.toBeTruthy();
  });
  it('impide desactivar una clase con inscripciones activas', async () => {
    const created = await service.create(input());
    const guarded = new ClassesService(repo, {
      assertClassCanDeactivate: async () => {
        throw new DomainError('CLASS_HAS_ACTIVE_ENROLLMENTS', 'Tiene inscripciones activas');
      },
    } as never);
    await expect(guarded.deactivate(created.id)).rejects.toMatchObject({
      code: 'CLASS_HAS_ACTIVE_ENROLLMENTS',
    });
  });
  it('permite reducir el cupo por encima o exactamente hasta la ocupaciÃ³n activa', async () => {
    const created = await service.create(input());
    repo.enrollmentCounts.set(created.id, { active: 15, ended: 5 });
    await expect(service.update(created.id, { capacity: 18 })).resolves.toMatchObject({
      capacity: 18,
    });
    await expect(service.update(created.id, { capacity: 15 })).resolves.toMatchObject({
      capacity: 15,
    });
  });
  it('rechaza reducir el cupo por debajo de la ocupaciÃ³n activa', async () => {
    const created = await service.create(input());
    repo.enrollmentCounts.set(created.id, { active: 15, ended: 5 });
    await expect(service.update(created.id, { capacity: 14 })).rejects.toMatchObject({
      code: 'CLASS_CAPACITY_BELOW_ENROLLMENT_COUNT',
      details: { activeEnrollmentCount: 15, requestedCapacity: 14 },
    });
  });
  it('no cuenta inscripciones finalizadas para el cupo mÃ­nimo', async () => {
    const created = await service.create(input());
    repo.enrollmentCounts.set(created.id, { active: 10, ended: 5 });
    await expect(service.update(created.id, { capacity: 10 })).resolves.toMatchObject({
      capacity: 10,
    });
  });
});
