import type {
  ApplyCreditDto,
  CorrectPaymentDto,
  CreateOtherPaymentDto,
  CreatePaymentDto,
  PaymentMethodDto,
  ReallocatePaymentDto,
  RefundPaymentDto,
} from '@academy/contracts';
import { Prisma } from '@academy/database';
import { Inject, Injectable } from '@nestjs/common';
import { validateReason } from '../../audit/domain/audit';
import { DomainError } from '../../shared/domain/domain-error';
import { assertConceptDetail, validateOtherPayment, validateWalkIn } from '../domain/other-payment';
import { cardSurchargeFor, parseCardType } from '../domain/card-surcharge';
import {
  backdatedPaidAt,
  correctedPaidAt,
  paymentCorrectionChanges,
} from '../domain/payment-correction';

const timeZone = () => process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires';
import {
  PAYMENTS_REPOSITORY,
  type PaymentQuery,
  type PaymentsRepository,
} from './payments.repository';

const methods: readonly PaymentMethodDto[] = ['CASH', 'MERCADO_PAGO', 'TRANSFER', 'CARD'];

@Injectable()
export class PaymentsService {
  constructor(@Inject(PAYMENTS_REPOSITORY) private readonly repository: PaymentsRepository) {}

  /** isAdministration: puede cargar la fecha real y elegir las cuotas (Administración/Dirección). */
  async create(
    input: CreatePaymentDto,
    actorId: string,
    isAdministration = false,
    now = new Date(),
  ) {
    const tenders = this.tenders(input.tenders);
    const paidAt = this.paidAt(input.paidDate, isAdministration, now);
    const chargeIds = this.chargeIds(input.monthlyChargeIds);
    const cardType = parseCardType(input.cardType);
    const cardSurcharge = cardType ? cardSurchargeFor(tenders, cardType) : null;
    if (chargeIds && !isAdministration)
      throw new DomainError(
        'FORBIDDEN',
        'Solo Administración o Dirección pueden elegir las cuotas que se pagan',
      );
    return this.repository.create(
      input.studentId,
      tenders,
      actorId,
      paidAt ?? undefined,
      chargeIds ?? undefined,
      cardSurcharge ?? undefined,
      input.allowCredit === true,
    );
  }

  /** Parte de un otro cobro pagada con saldo a favor; null si no se usa. */
  private creditAmount(value: unknown) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || !/^\d{1,10}(?:\.\d{1,2})?$/.test(value))
      throw new DomainError('VALIDATION_ERROR', 'El saldo a usar debe ser un decimal positivo', {
        field: 'creditAmount',
      });
    const amount = new Prisma.Decimal(value);
    return amount.isZero() ? null : amount.toFixed(2);
  }

  /** Cuotas elegidas; null si no se eligió ninguna (se imputa desde la más vieja). */
  private chargeIds(value: unknown) {
    if (value === undefined || value === null) return null;
    if (
      !Array.isArray(value) ||
      value.length > 60 ||
      value.some((id) => typeof id !== 'string' || !id)
    )
      throw new DomainError('VALIDATION_ERROR', 'Las cuotas elegidas no son válidas', {
        field: 'monthlyChargeIds',
      });
    if (value.length === 0) return null;
    const ids = value as string[];
    if (new Set(ids).size !== ids.length)
      throw new DomainError('VALIDATION_ERROR', 'Una cuota está repetida', {
        field: 'monthlyChargeIds',
      });
    return ids;
  }

  /** Fecha real de un pago cargado tarde; solo quien puede anular pagos (Administración/Dirección). */
  private paidAt(paidDate: unknown, canBackdate: boolean, now: Date) {
    const paidAt = backdatedPaidAt(paidDate, now, timeZone());
    if (paidAt && !canBackdate)
      throw new DomainError(
        'FORBIDDEN',
        'Solo Administración o Dirección pueden cargar un pago con otra fecha',
      );
    return paidAt;
  }

  async createOther(
    input: CreateOtherPaymentDto,
    actorId: string,
    canBackdate = false,
    now = new Date(),
  ) {
    const creditAmount = this.creditAmount(input.creditAmount);
    // Si todo se paga con saldo a favor, no hace falta ningún medio.
    const tenders =
      creditAmount && Array.isArray(input.tenders) && input.tenders.length === 0
        ? []
        : this.tenders(input.tenders);
    const paidAt = this.paidAt(input.paidDate, canBackdate, now);
    const other = validateOtherPayment(input);
    if (other.conceptId) {
      const concept = await this.repository.findConcept(other.conceptId);
      if (!concept)
        throw new DomainError('PAYMENT_CONCEPT_NOT_FOUND', 'Concepto de cobro no encontrado');
      if (concept.status !== 'ACTIVE')
        throw new DomainError('PAYMENT_CONCEPT_INACTIVE', 'El concepto elegido está desactivado', {
          field: 'conceptId',
        });
      assertConceptDetail(concept.requiresDetail, other.detail);
    }
    if (other.concept === 'CARD_SURCHARGE' && tenders.some((tender) => tender.method !== 'CARD'))
      throw new DomainError('VALIDATION_ERROR', 'El recargo por tarjeta se cobra con tarjeta', {
        field: 'tenders',
      });
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
    // Alumno o, solo en la clase suelta, alumno eventual (nombre y, si los da, teléfono y DNI).
    const studentId = input.studentId ?? null;
    if (studentId && input.walkIn)
      throw new DomainError(
        'VALIDATION_ERROR',
        'Elegí un alumno o un alumno eventual, no los dos',
        {
          field: 'walkIn',
        },
      );
    const walkIn = studentId ? null : validateWalkIn(input.walkIn);
    if (creditAmount && (!studentId || other.concept === 'CARD_SURCHARGE'))
      throw new DomainError(
        'VALIDATION_ERROR',
        'El saldo a favor solo se usa en cobros de un alumno, no en el recargo por tarjeta',
        { field: 'creditAmount' },
      );
    if (walkIn && other.concept !== 'SINGLE_CLASS')
      throw new DomainError(
        'VALIDATION_ERROR',
        'Solo la clase suelta se puede cobrar a un alumno eventual',
        { field: 'walkIn' },
      );
    const cardType = parseCardType(input.cardType);
    if (cardType && walkIn)
      throw new DomainError(
        'VALIDATION_ERROR',
        'Al alumno eventual no se le calcula recargo: cobralo como Recargo por tarjeta a un alumno',
        { field: 'cardType' },
      );
    if (cardType && other.concept === 'CARD_SURCHARGE')
      throw new DomainError('VALIDATION_ERROR', 'El recargo no lleva otro recargo', {
        field: 'cardType',
      });
    const cardSurcharge = cardType ? cardSurchargeFor(tenders, cardType) : null;
    const data = { studentId, walkIn, ...other, teacherId, creditAmount, cardSurcharge };
    return paidAt
      ? this.repository.createOther(data, tenders, actorId, paidAt)
      : this.repository.createOther(data, tenders, actorId);
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
    const [confirmedTotal, creditTotal] = await Promise.all([
      this.repository.confirmedTotal(studentId),
      this.repository.creditTotal(studentId),
    ]);
    return { confirmedTotal, creditTotal };
  }

  void(id: string, actorId: string, reason: unknown) {
    return this.repository.void(id, actorId, validateReason(reason));
  }

  async correct(id: string, input: CorrectPaymentDto | null, actorId: string, now = new Date()) {
    const reason = validateReason(input?.reason);
    const tenders = this.tenders(input?.tenders ?? []);
    const original = await this.get(id);
    if (original.status === 'VOID')
      throw new DomainError('PAYMENT_ALREADY_VOID', 'El pago ya está anulado');
    const paidAt = correctedPaidAt(new Date(original.paidAt), input?.paidDate, now, timeZone());
    if (
      !paymentCorrectionChanges(
        { tenders: original.tenders, paidAt: new Date(original.paidAt) },
        { tenders, paidAt },
      )
    )
      throw new DomainError('VALIDATION_ERROR', 'No hay cambios para corregir', { field: 'body' });
    return this.repository.correct(id, { tenders, paidAt }, actorId, reason);
  }

  /** Usa el saldo a favor del alumno en sus cuotas pendientes, sin tocar la caja. */
  async applyCredit(input: ApplyCreditDto | null, actorId: string) {
    const reason =
      input?.reason === undefined || input?.reason === null || input.reason === ''
        ? 'Se aplica el saldo a favor a las cuotas pendientes'
        : validateReason(input.reason);
    return this.repository.applyCredit(input?.studentId ?? '', actorId, reason);
  }

  /** Devuelve saldo a favor de un pago (Dirección); solo el efectivo puede salir de su turno. */
  async refund(id: string, input: RefundPaymentDto | null, actorId: string) {
    const reason = validateReason(input?.reason);
    if (!input || !methods.includes(input.method))
      throw new DomainError('VALIDATION_ERROR', 'Elegí cómo se devuelve', { field: 'method' });
    if (typeof input.amount !== 'string' || !/^\d{1,10}(?:\.\d{1,2})?$/.test(input.amount))
      throw new DomainError('VALIDATION_ERROR', 'El importe debe ser un decimal positivo', {
        field: 'amount',
      });
    const amount = new Prisma.Decimal(input.amount);
    if (amount.lessThanOrEqualTo(0))
      throw new DomainError('VALIDATION_ERROR', 'El importe debe ser mayor a cero', {
        field: 'amount',
      });
    return this.repository.refund(
      id,
      {
        amount: amount.toFixed(2),
        method: input.method,
        fromCashShift: input.method === 'CASH' && input.fromCashShift === true,
      },
      actorId,
      reason,
    );
  }

  /** Cambia las cuotas a las que se imputó un pago, sin tocar el pago ni la caja. */
  async reallocate(id: string, input: ReallocatePaymentDto | null, actorId: string) {
    const reason = validateReason(input?.reason);
    const rows = input?.allocations;
    // Sin cuotas, el pago entero queda como saldo a favor (por ejemplo, un pago duplicado).
    if (!Array.isArray(rows) || rows.length > 60)
      throw new DomainError('VALIDATION_ERROR', 'Las cuotas elegidas no son válidas', {
        field: 'allocations',
      });
    const allocations = rows.map((row, index) => {
      if (
        !row ||
        typeof row !== 'object' ||
        typeof row.amount !== 'string' ||
        !/^\d{1,10}(?:\.\d{1,2})?$/.test(row.amount) ||
        new Prisma.Decimal(row.amount).lessThanOrEqualTo(0)
      )
        throw new DomainError('VALIDATION_ERROR', 'El importe debe ser mayor a cero', {
          field: `allocations.${index}.amount`,
        });
      return {
        monthlyChargeId: row.monthlyChargeId,
        amount: new Prisma.Decimal(row.amount).toFixed(2),
      };
    });
    if (new Set(allocations.map(({ monthlyChargeId }) => monthlyChargeId)).size !== rows.length)
      throw new DomainError('VALIDATION_ERROR', 'Una cuota está repetida', {
        field: 'allocations',
      });
    const payment = await this.get(id);
    if (payment.status === 'VOID')
      throw new DomainError('PAYMENT_ALREADY_VOID', 'El pago ya está anulado');
    if (payment.kind !== 'CHARGES')
      throw new DomainError('VALIDATION_ERROR', 'Este cobro no se imputa a cuotas', {
        field: 'allocations',
      });
    return this.repository.reallocate(id, allocations, actorId, reason);
  }
}
