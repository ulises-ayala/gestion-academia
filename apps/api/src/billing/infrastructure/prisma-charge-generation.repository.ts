import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { BILLING_REPOSITORY, type BillingRepository } from '../application/billing.repository';
import type {
  ChargeGenerationRepository,
  GeneratedChargeData,
} from '../application/charge-generation.repository';
import { mapTariff } from './prisma-billing.repository';

const periodDate = (period: string) => new Date(`${period}-01T00:00:00.000Z`);
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

@Injectable()
export class PrismaChargeGenerationRepository implements ChargeGenerationRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BILLING_REPOSITORY) private readonly billing: BillingRepository,
  ) {}

  async findEnrollment(id: string) {
    const item = await this.prisma.enrollment.findUnique({
      where: { id },
      select: {
        id: true,
        studentId: true,
        classId: true,
        status: true,
        startDate: true,
        endDate: true,
        class: { select: { name: true } },
      },
    });
    if (!item) return null;
    return {
      id: item.id,
      studentId: item.studentId,
      classId: item.classId,
      className: item.class.name,
      status: item.status,
      startDate: isoDate(item.startDate),
      endDate: item.endDate ? isoDate(item.endDate) : null,
    };
  }

  async classTariffs(classId: string) {
    const items = await this.prisma.tariff.findMany({
      where: { classId },
      orderBy: { validFrom: 'desc' },
    });
    return items.map(mapTariff);
  }

  async conditionsFor(enrollmentId: string, period: string) {
    const date = periodDate(period);
    const items = await this.prisma.enrollmentBillingCondition.findMany({
      where: {
        enrollmentId,
        effectiveFrom: { lte: date },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: date } }],
      },
      select: { type: true, calculation: true, configuredValue: true },
    });
    return items.map((item) => ({
      type: item.type,
      calculation: item.calculation,
      configuredValue: item.configuredValue.toFixed(2),
    }));
  }

  async chargeExists(enrollmentId: string, period: string) {
    const count = await this.prisma.monthlyCharge.count({
      where: { enrollmentId, period: periodDate(period) },
    });
    return count > 0;
  }

  create(data: GeneratedChargeData, actorId: string) {
    return this.billing.createCharge(
      {
        ...data,
        period: `${data.period}-01`,
        discountAmount: '0.00',
        finalAmount: data.baseAmount,
      },
      actorId,
    );
  }
}
