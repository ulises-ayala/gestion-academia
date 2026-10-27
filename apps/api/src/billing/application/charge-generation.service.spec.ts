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
const tariff = (over: Partial<TariffDto>): TariffDto => ({
  id: 't1',
  classId: 'c1',
  name: 'Zumba mensual',
  amount: '40000.00',
  validFrom: '2026-09-01',
  validTo: null,
  status: 'ACTIVE',
  createdAt: '',
  updatedAt: '',
  ...over,
});

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
    tariff({}),
    tariff({ id: 't-ago', validFrom: '2026-08-01', validTo: '2026-08-31', status: 'INACTIVE' }),
  ];
  conditions: ChargeConditionForPreview[] = [];
  existing = new Set<string>();
  overlap = false;
  moved: { enrollmentId: string; newStart: string; actorId: string } | null = null;
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
  async overlapsOtherEnrollment() {
    return this.overlap;
  }
  async moveEnrollmentStart(id: string, newStart: string, actor: string) {
    this.moved = { enrollmentId: id, newStart, actorId: actor };
  }
  async create(data: GeneratedChargeData, actor: string) {
    this.created.push({ data, actorId: actor });
    this.existing.add(data.period);
    return { id: 'm-' + data.period, period: data.period } as MonthlyChargeDto;
  }
}

const setup = () => {
  const repository = new MemoryRepository();
  return { repository, service: new ChargeGenerationService(repository) };
};
const reception = { id: actorId, canBackfill: false };
const manager = { id: actorId, canBackfill: true };

describe('ChargeGenerationService', () => {
  it('previsualiza un mes con la tarifa de la clase y vencimiento el 10', async () => {
    const { service } = setup();
    await expect(
      service.preview({ enrollmentId, period: '2026-11' }, reception, now),
    ).resolves.toEqual({
      enrollmentId,
      className: 'Zumba',
      months: [
        {
          period: '2026-11',
          dueDate: '2026-11-10',
          tariff: { id: 't1', name: 'Zumba mensual', amount: '40000.00' },
          studentDueAmount: '40000.00',
          adjustments: [],
          alreadyExists: false,
          lateFeeOnCollect: false,
        },
      ],
      newCount: 1,
      newTotal: '40000.00',
      lateFeeCount: 0,
      enrollmentStartChange: null,
    });
  });

  it('aplica becas y descuentos vigentes en la vista previa', async () => {
    const { repository, service } = setup();
    repository.conditions = [
      { type: 'TEACHER_DISCOUNT', calculation: 'PERCENTAGE', configuredValue: '25.00' },
    ];
    const preview = await service.preview({ enrollmentId, period: '2026-11' }, reception, now);
    expect(preview.months[0]).toMatchObject({
      studentDueAmount: '30000.00',
      adjustments: ['TEACHER_DISCOUNT'],
    });
  });

  it('pago anticipado: Admisión genera el mes actual y el siguiente juntos', async () => {
    const { repository, service } = setup();
    const preview = await service.preview(
      { enrollmentId, period: '2026-10', untilPeriod: '2026-11' },
      reception,
      now,
    );
    expect(preview).toMatchObject({ newCount: 2, newTotal: '80000.00', lateFeeCount: 1 });
    await service.generate(
      { enrollmentId, period: '2026-10', untilPeriod: '2026-11' },
      reception,
      now,
    );
    expect(repository.created.map(({ data }) => [data.period, data.dueDate])).toEqual([
      ['2026-10', '2026-10-10'],
      ['2026-11', '2026-11-10'],
    ]);
  });

  it('deuda vieja: Administración carga varios meses, con la tarifa histórica, y saltea los existentes', async () => {
    const { repository, service } = setup();
    repository.existing.add('2026-10');
    const preview = await service.preview(
      { enrollmentId, period: '2026-08', untilPeriod: '2026-10' },
      manager,
      now,
    );
    expect(
      preview.months.map((month) => [month.period, month.tariff.id, month.alreadyExists]),
    ).toEqual([
      ['2026-08', 't-ago', false],
      ['2026-09', 't1', false],
      ['2026-10', 't1', true],
    ]);
    expect(preview).toMatchObject({ newCount: 2, newTotal: '80000.00', lateFeeCount: 2 });
    await expect(
      service.generate({ enrollmentId, period: '2026-08', untilPeriod: '2026-10' }, manager, now),
    ).resolves.toMatchObject({ skippedPeriods: ['2026-10'] });
    expect(repository.created.map(({ data }) => data.period)).toEqual(['2026-08', '2026-09']);
  });

  it('si la deuda es anterior al inicio, Administración adelanta la inscripción', async () => {
    const { repository, service } = setup();
    repository.enrollment = { ...repository.enrollment, startDate: '2026-10-01' };
    const preview = await service.preview(
      { enrollmentId, period: '2026-09', untilPeriod: '2026-10' },
      manager,
      now,
    );
    expect(preview.enrollmentStartChange).toEqual({ from: '2026-10-01', to: '2026-09-01' });
    await service.generate(
      { enrollmentId, period: '2026-09', untilPeriod: '2026-10' },
      manager,
      now,
    );
    expect(repository.moved).toEqual({ enrollmentId, newStart: '2026-09-01', actorId });
  });

  it('no adelanta el inicio si se pisa con otra inscripción a la misma clase', async () => {
    const { repository, service } = setup();
    repository.enrollment = { ...repository.enrollment, startDate: '2026-10-01' };
    repository.overlap = true;
    await expect(
      service.generate({ enrollmentId, period: '2026-09' }, manager, now),
    ).rejects.toMatchObject({ code: 'ENROLLMENT_START_CONFLICT' });
    expect(repository.moved).toBeNull();
    expect(repository.created).toHaveLength(0);
  });

  it('Admisión no carga meses anteriores ni antes del inicio', async () => {
    const { repository, service } = setup();
    await expect(
      service.generate({ enrollmentId, period: '2026-09' }, reception, now),
    ).rejects.toMatchObject({ code: 'CHARGE_PERIOD_REQUIRES_MANAGER' });
    repository.enrollment = { ...repository.enrollment, startDate: '2026-11-01' };
    await expect(
      service.generate({ enrollmentId, period: '2026-10' }, reception, now),
    ).rejects.toMatchObject({ code: 'CHARGE_PERIOD_BEFORE_ENROLLMENT' });
  });

  it('valida el rango: orden, máximo de meses y meses ya generados', async () => {
    const { repository, service } = setup();
    await expect(
      service.preview({ enrollmentId, period: '2026-11', untilPeriod: '2026-10' }, manager, now),
    ).rejects.toMatchObject({ details: { field: 'untilPeriod' } });
    await expect(
      service.preview({ enrollmentId, period: '2025-08', untilPeriod: '2026-10' }, manager, now),
    ).rejects.toMatchObject({ details: { field: 'untilPeriod' } });
    repository.existing.add('2026-11');
    await expect(
      service.generate({ enrollmentId, period: '2026-11' }, reception, now),
    ).rejects.toMatchObject({ code: 'MONTHLY_CHARGE_ALREADY_EXISTS' });
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
