import type { CreateMonthlyChargeDto, CreateTariffDto, UpdateTariffDto } from '@academy/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../shared/domain/domain-error';
import { validateChargeDates, validateTariff } from '../domain/billing';
import { BILLING_REPOSITORY, type BillingRepository, type ChargeQuery } from './billing.repository';

@Injectable()
export class BillingService {
  constructor(@Inject(BILLING_REPOSITORY) private readonly repository: BillingRepository) {}

  listTariffs(status?: 'ACTIVE' | 'INACTIVE') {
    return this.repository.listTariffs(status);
  }
  async getTariff(id: string) {
    const tariff = await this.repository.findTariff(id);
    if (!tariff) throw new DomainError('TARIFF_NOT_FOUND', 'Tarifa no encontrada');
    return tariff;
  }
  createTariff(input: CreateTariffDto) {
    return this.repository.createTariff(validateTariff(input));
  }
  async updateTariff(id: string, patch: UpdateTariffDto) {
    const current = await this.getTariff(id);
    return this.repository.updateTariff(
      id,
      validateTariff({
        name: patch.name ?? current.name,
        amount: patch.amount ?? current.amount,
        validFrom: patch.validFrom ?? current.validFrom,
        validTo: patch.validTo === undefined ? current.validTo : patch.validTo,
        status: patch.status ?? current.status,
      }),
    );
  }

  async createCharge(input: CreateMonthlyChargeDto) {
    const { period, dueDate } = validateChargeDates(input.period, input.dueDate);
    const enrollment = await this.repository.findEnrollment(input.enrollmentId);
    if (!enrollment) throw new DomainError('ENROLLMENT_NOT_FOUND', 'Inscripción no encontrada');
    if (enrollment.status !== 'ACTIVE')
      throw new DomainError(
        'ENROLLMENT_INACTIVE_FOR_CHARGE',
        'La inscripción debe estar activa para generar una cuota',
      );
    const tariff = await this.repository.findTariff(input.tariffId);
    if (!tariff) throw new DomainError('TARIFF_NOT_FOUND', 'Tarifa no encontrada');
    if (tariff.status !== 'ACTIVE')
      throw new DomainError(
        'TARIFF_INACTIVE',
        'No se puede generar una cuota con una tarifa inactiva',
      );
    if (period < tariff.validFrom || (tariff.validTo && period > tariff.validTo))
      throw new DomainError(
        'TARIFF_NOT_VALID_FOR_PERIOD',
        'La tarifa no está vigente para el período indicado',
      );
    return this.repository.createCharge({
      studentId: enrollment.studentId,
      enrollmentId: enrollment.id,
      tariffId: tariff.id,
      period,
      baseAmount: tariff.amount,
      discountAmount: '0.00',
      finalAmount: tariff.amount,
      dueDate,
    });
  }
  async getCharge(id: string) {
    const charge = await this.repository.findCharge(id);
    if (!charge) throw new DomainError('MONTHLY_CHARGE_NOT_FOUND', 'Cuota no encontrada');
    return charge;
  }
  listCharges(query: ChargeQuery) {
    return this.repository.listCharges(query);
  }
}
