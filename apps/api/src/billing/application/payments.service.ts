import type { CreateOtherPaymentDto, CreatePaymentDto, PaymentMethodDto } from '@academy/contracts';
import { Prisma } from '@academy/database';
import { Inject, Injectable } from '@nestjs/common';
import { validateReason } from '../../audit/domain/audit';
import { DomainError } from '../../shared/domain/domain-error';
import { validateOtherPayment } from '../domain/other-payment';
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
    return this.repository.create(input.studentId, this.tenders(input.tenders), actorId);
  }

  async createOther(input: CreateOtherPaymentDto, actorId: string) {
    const tenders = this.tenders(input.tenders);
    const other = validateOtherPayment(input);
    let teacherId = other.teacherId;
    if (other.classId) {
      const academicClass = await this.repository.findClass(other.classId);
      if (!academicClass) throw new DomainError('CLASS_NOT_FOUND', 'Clase no encontrada');
      if (academicClass.status !== 'ACTIVE')
        throw new DomainError('CLASS_INACTIVE', 'La clase elegida está desactivada', {
          field: 'classId',
        });
      // Por defecto, el profesor de la clase; se puede indicar otro (por ejemplo, un reemplazo).
      if (!teacherId) teacherId = academicClass.teacherId;
      else if (teacherId !== academicClass.teacherId) {
        const status = await this.repository.findTeacherStatus(teacherId);
        if (!status) throw new DomainError('TEACHER_NOT_FOUND', 'Profesor no encontrado');
        if (status !== 'ACTIVE')
          throw new DomainError('TEACHER_INACTIVE', 'El profesor elegido está inactivo', {
            field: 'teacherId',
          });
      }
    }
    return this.repository.createOther(
      { studentId: input.studentId, ...other, teacherId },
      tenders,
      actorId,
    );
  }

  private tenders(input: CreatePaymentDto['tenders']) {
    if (!Array.isArray(input) || input.length === 0)
      throw new DomainError('PAYMENT_NO_TENDERS', 'Ingresá al menos un medio de pago');
    const seenMethods = new Set<PaymentMethodDto>();
    const tenders = input.map((tender, index) => {
      if (!tender || typeof tender !== 'object' || !methods.includes(tender.method))
        throw new DomainError('VALIDATION_ERROR', 'Medio de pago inválido', {
          field: `tenders.${index}.method`,
        });
      if (seenMethods.has(tender.method))
        throw new DomainError(
          'PAYMENT_DUPLICATE_TENDER',
          'Un medio no puede repetirse en el cobro',
        );
      seenMethods.add(tender.method);
      if (typeof tender.amount !== 'string' || !/^\d{1,10}(?:\.\d{1,2})?$/.test(tender.amount))
        throw new DomainError('VALIDATION_ERROR', 'El importe debe ser un decimal positivo', {
          field: `tenders.${index}.amount`,
        });
      const amount = new Prisma.Decimal(tender.amount);
      if (amount.lessThanOrEqualTo(0))
        throw new DomainError('VALIDATION_ERROR', 'El importe debe ser mayor a cero', {
          field: `tenders.${index}.amount`,
        });
      return { method: tender.method, amount: amount.toFixed(2) };
    });
    const total = tenders.reduce((sum, tender) => sum.plus(tender.amount), new Prisma.Decimal(0));
    if (total.greaterThan('9999999999.99'))
      throw new DomainError('VALIDATION_ERROR', 'El importe total supera el máximo permitido', {
        field: 'tenders',
      });
    return tenders;
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
