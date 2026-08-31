import type { MonthlyChargeDto, TariffDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import { DomainError } from '../../shared/domain/domain-error';
import type { BillingRepository, ChargeQuery, EnrollmentForCharge } from './billing.repository';
import { BillingService } from './billing.service';

const studentId = crypto.randomUUID();
const enrollmentId = crypto.randomUUID();
const secondEnrollmentId = crypto.randomUUID();

class MemoryBillingRepository implements BillingRepository {
  tariffs: TariffDto[] = [];
  charges: MonthlyChargeDto[] = [];
  enrollments = new Map<string, EnrollmentForCharge>([
    [enrollmentId, { id: enrollmentId, studentId, status: 'ACTIVE' }],
    [secondEnrollmentId, { id: secondEnrollmentId, studentId, status: 'ACTIVE' }],
  ]);
  async listTariffs(status?: 'ACTIVE' | 'INACTIVE') {
    return this.tariffs.filter((item) => !status || item.status === status);
  }
  async findTariff(id: string) {
    return this.tariffs.find((item) => item.id === id) ?? null;
  }
  async createTariff(data: Omit<TariffDto, 'id' | 'createdAt' | 'updatedAt'>) {
    const item = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.tariffs.push(item);
    return item;
  }
  async updateTariff(id: string, data: Omit<TariffDto, 'id' | 'createdAt' | 'updatedAt'>) {
    const current = this.tariffs.find((item) => item.id === id)!;
    const updated = { ...current, ...data, updatedAt: new Date().toISOString() };
    this.tariffs[this.tariffs.indexOf(current)] = updated;
    return updated;
  }
  async findEnrollment(id: string) {
    return this.enrollments.get(id) ?? null;
  }
  async createCharge(data: {
    studentId: string;
    enrollmentId: string;
    tariffId: string;
    period: string;
    baseAmount: string;
    discountAmount: string;
    finalAmount: string;
    dueDate: string;
  }) {
    if (
      this.charges.some(
        (item) =>
          item.enrollmentId === data.enrollmentId && item.period === data.period.slice(0, 7),
      )
    )
      throw new DomainError('MONTHLY_CHARGE_ALREADY_EXISTS', 'Cuota duplicada');
    const tariff = this.tariffs.find((item) => item.id === data.tariffId);
    const item: MonthlyChargeDto = {
      ...data,
      id: crypto.randomUUID(),
      period: data.period.slice(0, 7),
      status: 'PENDING',
      paidAmount: '0.00',
      outstandingAmount: data.finalAmount,
      overdue: false,
      academicClass: { id: crypto.randomUUID(), name: 'Bachata' },
      tariff: { id: data.tariffId, name: tariff?.name ?? '' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.charges.push(item);
    return item;
  }
  async findCharge(id: string) {
    return this.charges.find((item) => item.id === id) ?? null;
  }
  async listCharges(query: ChargeQuery) {
    const items = this.charges.filter(
      (item) =>
        (!query.studentId || item.studentId === query.studentId) &&
        (!query.period || item.period === query.period.slice(0, 7)),
    );
    return { items, total: items.length };
  }
}

const createService = async () => {
  const repository = new MemoryBillingRepository();
  const service = new BillingService(repository);
  const tariff = await service.createTariff({
    name: 'Clase mensual',
    amount: '40000',
    validFrom: '2026-01-01',
  });
  return { repository, service, tariff };
};

describe('BillingService', () => {
  it('una inscripción genera una cuota con snapshot monetario', async () => {
    const { service, tariff } = await createService();
    await expect(
      service.createCharge({
        enrollmentId,
        tariffId: tariff.id,
        period: '2026-08',
        dueDate: '2026-08-10',
      }),
    ).resolves.toMatchObject({
      studentId,
      enrollmentId,
      baseAmount: '40000.00',
      discountAmount: '0.00',
      finalAmount: '40000.00',
      status: 'PENDING',
    });
  });

  it('no duplica enrollment + período y dos inscripciones generan dos cuotas', async () => {
    const { service, tariff } = await createService();
    const input = { tariffId: tariff.id, period: '2026-08', dueDate: '2026-08-05' };
    await service.createCharge({ ...input, enrollmentId });
    await expect(service.createCharge({ ...input, enrollmentId })).rejects.toMatchObject({
      code: 'MONTHLY_CHARGE_ALREADY_EXISTS',
    });
    await service.createCharge({ ...input, enrollmentId: secondEnrollmentId });
    await expect(service.listCharges({ studentId })).resolves.toMatchObject({ total: 2 });
  });

  it('cambiar la tarifa no modifica una cuota histórica', async () => {
    const { repository, service, tariff } = await createService();
    const charge = await service.createCharge({
      enrollmentId,
      tariffId: tariff.id,
      period: '2026-08',
      dueDate: '2026-08-01',
    });
    await service.updateTariff(tariff.id, { amount: '50000' });
    await expect(service.getCharge(charge.id)).resolves.toMatchObject({ finalAmount: '40000.00' });
    expect(repository.charges).toHaveLength(1);
  });

  it('rechaza tarifa inactiva e inscripción finalizada', async () => {
    const { repository, service, tariff } = await createService();
    await service.updateTariff(tariff.id, { status: 'INACTIVE' });
    await expect(
      service.createCharge({
        enrollmentId,
        tariffId: tariff.id,
        period: '2026-08',
        dueDate: '2026-08-05',
      }),
    ).rejects.toMatchObject({ code: 'TARIFF_INACTIVE' });
    await service.updateTariff(tariff.id, { status: 'ACTIVE' });
    repository.enrollments.set(enrollmentId, { id: enrollmentId, studentId, status: 'ENDED' });
    await expect(
      service.createCharge({
        enrollmentId,
        tariffId: tariff.id,
        period: '2026-08',
        dueDate: '2026-08-05',
      }),
    ).rejects.toMatchObject({ code: 'ENROLLMENT_INACTIVE_FOR_CHARGE' });
  });

  it.each(['-1', '1.234', 'abc'])('rechaza monto inválido %s', async (amount) => {
    const service = new BillingService(new MemoryBillingRepository());
    expect(() =>
      service.createTariff({ name: 'Mensual', amount, validFrom: '2026-01-01' }),
    ).toThrowError(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  it('rechaza relaciones inexistentes y vencimientos fuera del día 1 al 10', async () => {
    const { service, tariff } = await createService();
    await expect(
      service.createCharge({
        enrollmentId: crypto.randomUUID(),
        tariffId: tariff.id,
        period: '2026-08',
        dueDate: '2026-08-05',
      }),
    ).rejects.toMatchObject({ code: 'ENROLLMENT_NOT_FOUND' });
    await expect(
      service.createCharge({
        enrollmentId,
        tariffId: crypto.randomUUID(),
        period: '2026-08',
        dueDate: '2026-08-05',
      }),
    ).rejects.toMatchObject({ code: 'TARIFF_NOT_FOUND' });
    await expect(
      service.createCharge({
        enrollmentId,
        tariffId: tariff.id,
        period: '2026-08',
        dueDate: '2026-08-11',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_DUE_DATE' });
  });

  it('preserva cuotas al desactivar la tarifa y finalizar la inscripción', async () => {
    const { repository, service, tariff } = await createService();
    const charge = await service.createCharge({
      enrollmentId,
      tariffId: tariff.id,
      period: '2026-08',
      dueDate: '2026-08-05',
    });
    await service.updateTariff(tariff.id, { status: 'INACTIVE' });
    repository.enrollments.set(enrollmentId, { id: enrollmentId, studentId, status: 'ENDED' });
    await expect(service.getCharge(charge.id)).resolves.toMatchObject({ id: charge.id });
  });
});
