import type { CreatePaymentDto, PaymentMethodDto } from '@academy/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../shared/domain/domain-error';
import { validateReason } from '../../audit/domain/audit';
import {
  PAYMENTS_REPOSITORY,
  type PaymentQuery,
  type PaymentsRepository,
} from './payments.repository';

const methods: readonly PaymentMethodDto[] = ['CASH', 'MERCADO_PAGO', 'CARD'];

@Injectable()
export class PaymentsService {
  constructor(@Inject(PAYMENTS_REPOSITORY) private readonly repository: PaymentsRepository) {}

  async create(input: CreatePaymentDto, actorId: string) {
    if (!Array.isArray(input.monthlyChargeIds) || input.monthlyChargeIds.length === 0)
      throw new DomainError('PAYMENT_NO_CHARGES', 'Seleccioná al menos una cuota');
    if (new Set(input.monthlyChargeIds).size !== input.monthlyChargeIds.length)
      throw new DomainError('PAYMENT_DUPLICATE_CHARGE', 'Una cuota no puede repetirse en el pago');
    if (!methods.includes(input.paymentMethod))
      throw new DomainError('VALIDATION_ERROR', 'Medio de pago inválido', {
        field: 'paymentMethod',
      });
    return this.repository.create([...input.monthlyChargeIds].sort(), input.paymentMethod, actorId);
  }

  async get(id: string) {
    const payment = await this.repository.findById(id);
    if (!payment) throw new DomainError('PAYMENT_NOT_FOUND', 'Pago no encontrado');
    return payment;
  }

  list(query: PaymentQuery) {
    return this.repository.findPage(query);
  }

  async summary(studentId: string) {
    return { confirmedTotal: await this.repository.confirmedTotal(studentId) };
  }

  void(id: string, actorId: string, reason: unknown) {
    return this.repository.void(id, actorId, validateReason(reason));
  }
}
