import type { CreateClassDto, UpdateClassDto } from '@academy/contracts';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { EnrollmentsService } from '../../enrollments/application/enrollments.service';
import { DomainError } from '../../shared/domain/domain-error';
import { validateClass } from '../domain/academic-class';
import { CLASS_REPOSITORY, type ClassQuery, type ClassRepository } from './class.repository';
@Injectable()
export class ClassesService {
  constructor(
    @Inject(CLASS_REPOSITORY) private readonly repo: ClassRepository,
    @Optional() private readonly enrollments?: EnrollmentsService,
  ) {}
  list(query: ClassQuery) {
    return this.repo.findPage(query);
  }
  async get(id: string) {
    const item = await this.repo.findById(id);
    if (!item) throw new DomainError('CLASS_NOT_FOUND', 'Clase no encontrada');
    return item;
  }
  async create(input: CreateClassDto) {
    const data = validateClass(input);
    await this.validateReferences(data);
    return this.repo.create(data);
  }
  async update(id: string, patch: UpdateClassDto, actorId?: string) {
    const current = await this.get(id);
    const data = validateClass({
      name: patch.name ?? current.name,
      danceTypeId: patch.danceTypeId ?? current.danceType.id,
      teacherId: patch.teacherId ?? current.teacher.id,
      level: patch.level === undefined ? current.level : patch.level,
      capacity: patch.capacity ?? current.capacity,
      schedules:
        patch.schedules ??
        current.schedules.map((schedule) => ({
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          roomId: schedule.room.id,
        })),
      status: patch.status ?? current.status,
    });
    if (data.status === 'ACTIVE') await this.validateReferences(data);
    return this.repo.update(id, data, patch.capacity !== undefined, actorId);
  }
  async deactivate(id: string, actorId?: string) {
    await this.get(id);
    await this.enrollments?.assertClassCanDeactivate(id);
    return this.update(id, { status: 'INACTIVE' }, actorId);
  }
  reactivate(id: string, actorId?: string) {
    return this.update(id, { status: 'ACTIVE' }, actorId);
  }
  private async validateReferences(data: ReturnType<typeof validateClass>) {
    const teacher = await this.repo.findTeacher(data.teacherId);
    if (!teacher)
      throw new DomainError('TEACHER_NOT_FOUND', 'Profesor no encontrado', { field: 'teacherId' });
    if (teacher.status !== 'ACTIVE')
      throw new DomainError('TEACHER_INACTIVE', 'El profesor seleccionado está inactivo', {
        field: 'teacherId',
      });
    const danceType = await this.repo.findDanceType(data.danceTypeId);
    if (!danceType)
      throw new DomainError('DANCE_TYPE_NOT_FOUND', 'Tipo de danza no encontrado', {
        field: 'danceTypeId',
      });
    if (danceType.status !== 'ACTIVE')
      throw new DomainError('DANCE_TYPE_INACTIVE', 'El tipo de danza seleccionado está inactivo', {
        field: 'danceTypeId',
      });
    const roomIds = [...new Set(data.schedules.map((schedule) => schedule.roomId))];
    const rooms = await this.repo.findRooms(roomIds);
    const roomMap = new Map(rooms.map((room) => [room.id, room]));
    for (const roomId of roomIds) {
      const room = roomMap.get(roomId);
      if (!room)
        throw new DomainError('ROOM_NOT_FOUND', 'Salón no encontrado', { field: 'schedules' });
      if (room.status !== 'ACTIVE' || room.branchStatus !== 'ACTIVE')
        throw new DomainError(
          'ROOM_INACTIVE',
          'El salón seleccionado o su sucursal está inactivo',
          { field: 'schedules' },
        );
    }
  }
}
