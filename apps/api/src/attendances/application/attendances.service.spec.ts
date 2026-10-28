import type { EnrollmentDto } from '@academy/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnrollmentRepository } from '../../enrollments/application/enrollment.repository';
import { DomainError } from '../../shared/domain/domain-error';
import type {
  AttendancePersistenceInput,
  AttendanceRepository,
  AttendanceUpdateInput,
} from './attendance.repository';
import { AttendancesService } from './attendances.service';

const id = () => crypto.randomUUID();
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const enrollment = (overrides: Partial<EnrollmentDto> = {}) =>
  ({
    id: id(),
    startDate: '2026-08-01',
    endDate: null,
    status: 'ACTIVE',
    ...overrides,
  }) as EnrollmentDto;
const attendance = (overrides = {}) => ({
  id: id(),
  enrollmentId: id(),
  attendanceDate: date('2026-08-15'),
  scheduleId: null as string | null,
  status: 'PRESENT' as const,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AttendancesService', () => {
  let attendanceRepository: AttendanceRepository;
  let enrollmentRepository: EnrollmentRepository;
  let service: AttendancesService;

  beforeEach(() => {
    attendanceRepository = {
      create: vi.fn(async (input: AttendancePersistenceInput) => attendance(input)),
      findById: vi.fn(async () => null),
      findSlot: vi.fn(async () => null),
      classDaySchedules: vi.fn(async () => []),
      update: vi.fn(async (attendanceId: string, input: AttendanceUpdateInput) =>
        attendance({ id: attendanceId, ...input }),
      ),
      list: vi.fn(async () => []),
      roster: vi.fn(async () => []),
      dayClasses: vi.fn(async () => []),
      quickSearch: vi.fn(async () => []),
      saveRoster: vi.fn(async () => []),
    };
    enrollmentRepository = {
      findById: vi.fn(async () => enrollment()),
    } as unknown as EnrollmentRepository;
    service = new AttendancesService(attendanceRepository, enrollmentRepository);
  });

  it('crea una asistencia válida', async () => {
    const result = await service.create({
      enrollmentId: id(),
      attendanceDate: '2026-08-15',
      status: 'PRESENT',
    });
    expect(result.status).toBe('PRESENT');
    expect(attendanceRepository.create).toHaveBeenCalledOnce();
  });

  it('rechaza una inscripción inexistente', async () => {
    enrollmentRepository.findById = vi.fn(async () => null);
    await expect(
      service.create({ enrollmentId: id(), attendanceDate: '2026-08-15', status: 'PRESENT' }),
    ).rejects.toMatchObject({ code: 'ENROLLMENT_NOT_FOUND' } satisfies Partial<DomainError>);
  });

  it('rechaza el duplicado detectado antes de persistir', async () => {
    attendanceRepository.findSlot = vi.fn(async () => attendance());
    await expect(
      service.create({ enrollmentId: id(), attendanceDate: '2026-08-15', status: 'PRESENT' }),
    ).rejects.toMatchObject({ code: 'ATTENDANCE_ALREADY_EXISTS' } satisfies Partial<DomainError>);
  });

  it('rechaza una fecha anterior al inicio de la inscripción', async () => {
    enrollmentRepository.findById = vi.fn(async () => enrollment({ startDate: '2026-08-20' }));
    await expect(
      service.create({ enrollmentId: id(), attendanceDate: '2026-08-19', status: 'PRESENT' }),
    ).rejects.toMatchObject({
      code: 'ATTENDANCE_OUTSIDE_ENROLLMENT_PERIOD',
    } satisfies Partial<DomainError>);
  });

  it('rechaza una fecha posterior al fin de la inscripción', async () => {
    enrollmentRepository.findById = vi.fn(async () => enrollment({ endDate: '2026-08-20' }));
    await expect(
      service.create({ enrollmentId: id(), attendanceDate: '2026-08-21', status: 'ABSENT' }),
    ).rejects.toMatchObject({
      code: 'ATTENDANCE_OUTSIDE_ENROLLMENT_PERIOD',
    } satisfies Partial<DomainError>);
  });

  it('permite historia de una inscripción ENDED dentro de su vigencia', async () => {
    enrollmentRepository.findById = vi.fn(async () =>
      enrollment({ status: 'ENDED', startDate: '2026-08-01', endDate: '2026-08-20' }),
    );
    await expect(
      service.create({ enrollmentId: id(), attendanceDate: '2026-08-15', status: 'JUSTIFIED' }),
    ).resolves.toMatchObject({ status: 'JUSTIFIED' });
  });

  it('rechaza una fecha inexistente o con formato incorrecto', async () => {
    for (const attendanceDate of ['2026-02-30', '15/08/2026'])
      await expect(
        service.create({ enrollmentId: id(), attendanceDate, status: 'PRESENT' }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' } satisfies Partial<DomainError>);
  });

  it('actualiza status y notes sin alterar la identidad histórica', async () => {
    const current = attendance();
    attendanceRepository.findById = vi.fn(async () => current);
    await service.update(current.id, { status: 'ABSENT', notes: 'Avisó' });
    expect(attendanceRepository.update).toHaveBeenCalledWith(current.id, {
      status: 'ABSENT',
      notes: 'Avisó',
    });
  });

  it('ignora intentos de alterar enrollmentId o attendanceDate mediante PATCH', async () => {
    const current = attendance();
    attendanceRepository.findById = vi.fn(async () => current);
    await service.update(current.id, {
      status: 'JUSTIFIED',
      enrollmentId: id(),
      attendanceDate: '2026-08-20',
    } as never);
    expect(attendanceRepository.update).toHaveBeenCalledWith(current.id, { status: 'JUSTIFIED' });
  });

  it('rechaza la actualización de una asistencia inexistente', async () => {
    await expect(service.update(id(), { status: 'ABSENT' })).rejects.toMatchObject({
      code: 'ATTENDANCE_NOT_FOUND',
    } satisfies Partial<DomainError>);
  });

  it('delega quick-search con la consulta normalizada y la fecha seleccionada', async () => {
    const selectedDate = date('2026-08-15');
    await service.quickSearch('  Ana Paz  ', selectedDate);
    expect(attendanceRepository.quickSearch).toHaveBeenCalledWith('Ana Paz', selectedDate, false);
  });

  it('quick-search sin texto no consulta ni devuelve alumnos arbitrarios', async () => {
    const selectedDate = date('2026-08-15');
    expect(service.quickSearch('   ', selectedDate)).toEqual([]);
    expect(attendanceRepository.quickSearch).not.toHaveBeenCalled();
  });

  it('delega la vista de clases del día seleccionado', async () => {
    const selectedDate = date('2026-08-15');
    await service.dayClasses(selectedDate);
    expect(attendanceRepository.dayClasses).toHaveBeenCalledWith(selectedDate);
  });

  it('rechaza inscripciones repetidas antes de guardar un roster', async () => {
    const enrollmentId = id();
    await expect(
      service.saveRoster(
        {
          classId: id(),
          date: '2026-08-15',
          attendances: [
            { enrollmentId, status: 'PRESENT' },
            { enrollmentId, status: 'ABSENT' },
          ],
        },
        date('2026-08-15'),
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(attendanceRepository.saveRoster).not.toHaveBeenCalled();
  });

  describe('varios horarios el mismo día', () => {
    const early = { id: id(), startTime: '18:00', endTime: '19:00' };
    const late = { id: id(), startTime: '20:00', endTime: '21:00' };
    const classId = id();

    beforeEach(() => {
      enrollmentRepository.findById = vi.fn(async () => enrollment({ classId }));
      attendanceRepository.classDaySchedules = vi.fn(async () => [early, late]);
    });

    it('registra la asistencia del segundo horario aunque ya haya una en el primero', async () => {
      attendanceRepository.findSlot = vi.fn(async (_enrollmentId, _date, scheduleId) =>
        scheduleId === early.id ? attendance({ scheduleId: early.id }) : null,
      );
      await expect(
        service.create({
          enrollmentId: id(),
          attendanceDate: '2026-08-15',
          scheduleId: late.id,
          status: 'PRESENT',
        }),
      ).resolves.toMatchObject({ scheduleId: late.id, status: 'PRESENT' });
      expect(attendanceRepository.classDaySchedules).toHaveBeenCalledWith(classId, 'SATURDAY');
    });

    it('rechaza repetir la asistencia del mismo horario', async () => {
      attendanceRepository.findSlot = vi.fn(async () => attendance({ scheduleId: early.id }));
      await expect(
        service.create({
          enrollmentId: id(),
          attendanceDate: '2026-08-15',
          scheduleId: early.id,
          status: 'PRESENT',
        }),
      ).rejects.toMatchObject({
        code: 'ATTENDANCE_ALREADY_EXISTS',
        message: 'Ya existe una asistencia para esta inscripción en ese horario y fecha',
      });
    });

    it('pide elegir el horario cuando la clase tiene varios ese día', async () => {
      await expect(
        service.create({ enrollmentId: id(), attendanceDate: '2026-08-15', status: 'PRESENT' }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', details: { field: 'scheduleId' } });
      expect(attendanceRepository.create).not.toHaveBeenCalled();
    });

    it('rechaza un horario de otra clase o de otro día', async () => {
      await expect(
        service.create({
          enrollmentId: id(),
          attendanceDate: '2026-08-15',
          scheduleId: id(),
          status: 'PRESENT',
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', details: { field: 'scheduleId' } });
    });

    it('la planilla y su guardado son por horario', async () => {
      await expect(service.roster(classId, date('2026-08-15'), late.id)).resolves.toEqual({
        scheduleId: late.id,
        items: [],
      });
      expect(attendanceRepository.roster).toHaveBeenCalledWith(
        classId,
        date('2026-08-15'),
        late.id,
      );
      await service.saveRoster(
        {
          classId,
          scheduleId: early.id,
          date: '2026-08-15',
          attendances: [{ enrollmentId: id(), status: 'PRESENT' }],
        },
        date('2026-08-15'),
      );
      expect(attendanceRepository.saveRoster).toHaveBeenCalledWith(
        classId,
        date('2026-08-15'),
        early.id,
        [expect.objectContaining({ status: 'PRESENT' })],
      );
    });
  });

  it('sin horario indicado usa el único horario del día', async () => {
    const only = { id: id(), startTime: '19:00', endTime: '20:00' };
    attendanceRepository.classDaySchedules = vi.fn(async () => [only]);
    await service.create({ enrollmentId: id(), attendanceDate: '2026-08-15', status: 'PRESENT' });
    expect(attendanceRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ scheduleId: only.id }),
    );
  });

  it('si la clase no se dicta ese día la asistencia queda fuera de horario', async () => {
    await service.create({ enrollmentId: id(), attendanceDate: '2026-08-15', status: 'PRESENT' });
    expect(attendanceRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ scheduleId: null }),
    );
  });
});
