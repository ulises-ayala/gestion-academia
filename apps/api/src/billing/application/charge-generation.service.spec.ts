import type { MonthlyChargeDto, TariffDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import type {
  ChargeConditionForPreview,
  ChargeGenerationRepository,
  EnrollmentForGeneration,
  GeneratedChargeData,
} from './charge-generation.repository';
import { ChargeGenerationService } from './charge-generation.service';

const enrollmentId = crypto.randomUUID();
const actorId = crypto.randomUUID();
// 26/10/2026 15:00 en Buenos Aires.
const now = new Date('2026-10-26T18:00:00Z');

class MemoryRepository implements ChargeGenerationRepository {
  enrollment: EnrollmentForGeneration = {
    id: enrollmentId,
    studentId: 's1',
    classId: 'c1',
    className: 'Zumba',
    status: 'ACTIVE',
    startDate: '2026-03-02',
    endDate: null,
  };
  tariffs: TariffDto[] = [
    {
      id: 't1',
      classId: 'c1',
      name: 'Zumba mensual',
      amount: '40000.00',
      validFrom: '2026-09-01',
      validTo: null,
      status: 'ACTIVE',
      createdAt: '',
      updatedAt: '',
    },
  ];
  conditions: ChargeConditionForPreview[] = [];
  existing = new Set<string>();
  created: { data: GeneratedChargeData; actorId: string }[] = [];
  async findEnrollment(id: string) {
    return id === enrollmentId ? this.enrollment : null;
  }
  async classTariffs() {
    return this.tariffs;
  }
  async conditionsFor() {
    return this.conditions;
  }
  async chargeExists(_: string, period: string) {
    return this.existing.has(period);
  }
  async create(data: GeneratedChargeData, actor: string) {
    this.created.push({ data, actorId: actor });
    this.existing.add(data.period);
    return { id: 'm1', period: data.period } as MonthlyChargeDto;
  }
}

const setup = () => {
  const repository = new MemoryRepository();
  return { repository, service: new ChargeGenerationService(repository) };
};
const reception = { id: actorId, canBackfill: false };
const manager = { id: actorId, canBackfill: true };

describe('ChargeGenerationService', () => {
  it('previsualiza con la tarifa de la clase y vencimiento el 10', async () => {
    const { service } = setup();
    await expect(
      service.preview({ enrollmentId, period: '2026-11' }, reception, now),
    ).resolves.toEqual({
      enrollmentId,
      className: 'Zumba',
      period: '2026-11',
      dueDate: '2026-11-10',
      tariff: { id: 't1', name: 'Zumba mensual', amount: '40000.00' },
      studentDueAmount: '40000.00',
      adjustments: [],
      alreadyExists: false,
      lateFeeOnCollect: false,
    });
  });
  it('aplica becas y descuentos vigentes en la vista previa', async () => {
    const { repository, service } = setup();
    repository.conditions = [
      { type: 'TEACHER_DISCOUNT', calculation: 'PERCENTAGE', configuredValue: '25.00' },
    ];
    const preview = await service.preview({ enrollmentId, period: '2026-11' }, reception, now);
    expect(preview.studentDueAmount).toBe('30000.00');
    expect(preview.adjustments).toEqual(['TEACHER_DISCOUNT']);
  });
  it('avisa que una cuota ya vencida suma recargo al cobrarla', async () => {
    const { service } = setup();
    const preview = await service.preview({ enrollmentId, period: '2026-10' }, reception, now);
    expect(preview).toMatchObject({ dueDate: '2026-10-10', lateFeeOnCollect: true });
  });
  it('genera la cuota con la tarifa resuelta y deja al responsable', async () => {
    const { repository, service } = setup();
    await service.generate(
      { enrollmentId, period: '2026-12', dueDate: '2026-12-05' },
      reception,
      now,
    );
    expect(repository.created).toEqual([
      {
        data: {
          studentId: 's1',
          enrollmentId,
          tariffId: 't1',
          period: '2026-12',
          baseAmount: '40000.00',
          dueDate: '2026-12-05',
        },
        actorId,
      },
    ]);
  });
  it('no duplica el mes', async () => {
    const { repository, service } = setup();
    repository.existing.add('2026-11');
    await expect(
      service.generate({ enrollmentId, period: '2026-11' }, reception, now),
    ).rejects.toMatchObject({ code: 'MONTHLY_CHARGE_ALREADY_EXISTS' });
    await expect(
      service.preview({ enrollmentId, period: '2026-11' }, reception, now),
    ).resolves.toMatchObject({ alreadyExists: true });
  });
  it('Admisión no carga deuda de meses anteriores; Administración sí', async () => {
    const { repository, service } = setup();
    await expect(
      service.generate({ enrollmentId, period: '2026-09' }, reception, now),
    ).rejects.toMatchObject({ code: 'CHARGE_PERIOD_REQUIRES_MANAGER' });
    await service.generate({ enrollmentId, period: '2026-09' }, manager, now);
    expect(repository.created).toHaveLength(1);
  });
  it('rechaza inscripciones inexistentes o finalizadas y vencimientos fuera del 1 al 10', async () => {
    const { repository, service } = setup();
    await expect(
      service.generate({ enrollmentId: crypto.randomUUID(), period: '2026-11' }, reception, now),
    ).rejects.toMatchObject({ code: 'ENROLLMENT_NOT_FOUND' });
    await expect(
      service.generate({ enrollmentId, period: '2026-11', dueDate: '2026-11-15' }, reception, now),
    ).rejects.toMatchObject({ code: 'INVALID_DUE_DATE' });
    repository.enrollment = { ...repository.enrollment, status: 'ENDED' };
    await expect(
      service.generate({ enrollmentId, period: '2026-11' }, reception, now),
    ).rejects.toMatchObject({ code: 'ENROLLMENT_INACTIVE_FOR_CHARGE' });
    expect(repository.created).toHaveLength(0);
  });
});
