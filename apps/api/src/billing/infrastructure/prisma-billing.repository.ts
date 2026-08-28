import type { MonthlyChargeDto, TariffDto } from '@academy/contracts';
import { Prisma } from '@academy/database';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DomainError } from '../../shared/domain/domain-error';
import type { BillingRepository, ChargeQuery } from '../application/billing.repository';

const chargeInclude = {
  enrollment: { include: { class: { select: { id: true, name: true } } } },
  tariff: { select: { id: true, name: true } },
};
type IncludedCharge = Prisma.MonthlyChargeGetPayload<{ include: typeof chargeInclude }>;
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const mapTariff = (item: {
  id: string;
  name: string;
  amount: Prisma.Decimal;
  validFrom: Date;
  validTo: Date | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}): TariffDto => ({
  id: item.id,
  name: item.name,
  amount: item.amount.toFixed(2),
  validFrom: isoDate(item.validFrom),
  validTo: item.validTo ? isoDate(item.validTo) : null,
  status: item.status,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});
const mapCharge = (item: IncludedCharge): MonthlyChargeDto => ({
  id: item.id,
  studentId: item.studentId,
  enrollmentId: item.enrollmentId,
  tariffId: item.tariffId,
  period: isoDate(item.period).slice(0, 7),
  baseAmount: item.baseAmount.toFixed(2),
  discountAmount: item.discountAmount.toFixed(2),
  finalAmount: item.finalAmount.toFixed(2),
  dueDate: isoDate(item.dueDate),
  status: item.status,
  academicClass: item.enrollment.class,
  tariff: item.tariff,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

@Injectable()
export class PrismaBillingRepository implements BillingRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listTariffs(status?: 'ACTIVE' | 'INACTIVE') {
    const items = await this.prisma.tariff.findMany({
      where: status ? { status } : {},
      orderBy: [{ status: 'asc' }, { validFrom: 'desc' }, { name: 'asc' }],
    });
    return items.map(mapTariff);
  }
  async findTariff(id: string) {
    const item = await this.prisma.tariff.findUnique({ where: { id } });
    return item ? mapTariff(item) : null;
  }
  async createTariff(data: Omit<TariffDto, 'id' | 'createdAt' | 'updatedAt'>) {
    return mapTariff(
      await this.prisma.tariff.create({
        data: {
          ...data,
          validFrom: new Date(`${data.validFrom}T00:00:00.000Z`),
          validTo: data.validTo ? new Date(`${data.validTo}T00:00:00.000Z`) : null,
        },
      }),
    );
  }
  async updateTariff(id: string, data: Omit<TariffDto, 'id' | 'createdAt' | 'updatedAt'>) {
    return mapTariff(
      await this.prisma.tariff.update({
        where: { id },
        data: {
          ...data,
          validFrom: new Date(`${data.validFrom}T00:00:00.000Z`),
          validTo: data.validTo ? new Date(`${data.validTo}T00:00:00.000Z`) : null,
        },
      }),
    );
  }
  findEnrollment(id: string) {
    return this.prisma.enrollment.findUnique({
      where: { id },
      select: { id: true, studentId: true, status: true },
    });
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
    try {
      return mapCharge(
        await this.prisma.monthlyCharge.create({
          data: {
            ...data,
            period: new Date(`${data.period}T00:00:00.000Z`),
            dueDate: new Date(`${data.dueDate}T00:00:00.000Z`),
          },
          include: chargeInclude,
        }),
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new DomainError(
          'MONTHLY_CHARGE_ALREADY_EXISTS',
          'La inscripción ya tiene una cuota para ese período',
        );
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003')
        throw new DomainError('BILLING_RELATION_NOT_FOUND', 'La relación indicada no existe');
      throw error;
    }
  }
  async findCharge(id: string) {
    const item = await this.prisma.monthlyCharge.findUnique({
      where: { id },
      include: chargeInclude,
    });
    return item ? mapCharge(item) : null;
  }
  async listCharges(query: ChargeQuery) {
    const where = {
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.period ? { period: new Date(`${query.period}T00:00:00.000Z`) } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.monthlyCharge.findMany({
        where,
        include: chargeInclude,
        orderBy: [{ period: 'desc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.monthlyCharge.count({ where }),
    ]);
    return { items: items.map(mapCharge), total };
  }
}
