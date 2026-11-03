import type {
  ClosingFiguresDto,
  ClosingKindDto,
  ClosingPreviewDto,
  CollectionClosingDto,
  CollectionClosingSummaryDto,
  CreateClosingDto,
} from '@academy/contracts';
import { Prisma } from '@academy/database';
import { Injectable } from '@nestjs/common';
import { businessDayAt } from '../../dashboard/application/business-day';
import { PrismaService } from '../../database/prisma.service';
import { DomainError } from '../../shared/domain/domain-error';
import {
  addDays,
  closingChanges,
  closingPeriod,
  monthRange,
  nextClosingPeriod,
} from '../domain/closing';
import { renderClosingPdf } from '../domain/closing-pdf';
import { ReportsService } from './reports.service';

const timeZone = () => process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires';
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const dateValue = (date: string) => new Date(`${date}T00:00:00.000Z`);
const include = { createdBy: { select: { id: true, username: true } } };
type Row = Prisma.CollectionClosingGetPayload<{ include: typeof include }>;
const summary = (item: Row): CollectionClosingSummaryDto => ({
  id: item.id,
  kind: item.kind,
  fromDate: isoDate(item.fromDate),
  toDate: isoDate(item.toDate),
  total: (item.snapshot as unknown as ClosingFiguresDto).collections.total,
  createdBy: item.createdBy,
  createdAt: item.createdAt.toISOString(),
});

/**
 * Cierres semanales y mensuales de la recaudación. Cada cierre guarda una foto de los importes (y,
 * el mensual, de alumnos y deuda); las correcciones posteriores se ven comparando con hoy.
 */
@Injectable()
export class ClosingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
  ) {}

  private today(now = new Date()) {
    return businessDayAt(now, timeZone()).date;
  }

  /** Importes del período, con el mismo cálculo que Reportes. */
  async figures(
    kind: ClosingKindDto,
    fromDate: string,
    toDate: string,
  ): Promise<ClosingFiguresDto> {
    const day = (date: string) => businessDayAt(new Date(`${date}T15:00:00.000Z`), timeZone());
    const report = await this.reports.operational({
      from: day(fromDate).start,
      toExclusive: day(addDays(toDate, 1)).start,
      fromDate,
      toDate,
      page: 1,
      pageSize: 1,
      debtSort: 'highest',
    });
    const collections = {
      total: report.collections.total,
      byMethod: report.collections.byMethod,
      byConceptAndMethod: report.collections.byConceptAndMethod,
    };
    if (kind === 'WEEKLY')
      return { collections, refunds: report.collections.refunds, students: null };
    const [dropped, pendingCharges] = await Promise.all([
      // Bajas: alumnos con una inscripción finalizada en el mes y ninguna activa al cerrar.
      this.prisma.student.count({
        where: {
          enrollments: {
            some: { endDate: { gte: dateValue(fromDate), lte: dateValue(toDate) } },
            none: { status: 'ACTIVE' },
          },
        },
      }),
      this.prisma.monthlyCharge.count({ where: { status: { in: ['PENDING', 'PARTIAL'] } } }),
    ]);
    return {
      collections,
      refunds: report.collections.refunds,
      students: {
        active: report.summary.activeStudents,
        newStudents: report.summary.newStudents,
        dropped,
        pendingCharges,
        pendingDebt: report.summary.pendingDebt,
        overdueCharges: report.summary.overdueCharges,
        overdueDebt: report.summary.overdueDebt,
      },
    };
  }

  /**
   * Período a cerrar y sus importes de hoy, para revisar antes de guardar: el que se propone o, si
   * se indica, otro (`custom`). `closable` dice si se puede guardar tal cual.
   */
  async preview(
    kind: ClosingKindDto,
    custom: Omit<CreateClosingDto, 'kind'> | null = null,
    now = new Date(),
  ): Promise<ClosingPreviewDto> {
    const today = this.today(now);
    let period: { fromDate: string; toDate: string; closable: boolean; reason: string | null };
    if (custom && (custom.month || custom.fromDate || custom.toDate)) {
      try {
        period = { ...closingPeriod({ kind, ...custom }, today), closable: true, reason: null };
      } catch (error) {
        if (!(error instanceof DomainError)) throw error;
        // El mes en curso se puede mirar aunque todavía no se pueda cerrar.
        if (kind === 'MONTHLY' && custom.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(custom.month))
          period = { ...monthRange(custom.month), closable: false, reason: error.message };
        else throw error;
      }
    } else {
      const last = await this.prisma.collectionClosing.findFirst({
        where: { kind },
        orderBy: { toDate: 'desc' },
      });
      period = nextClosingPeriod(kind, last ? isoDate(last.toDate) : null, today);
    }
    return {
      kind,
      ...period,
      figures: await this.figures(kind, period.fromDate, period.toDate),
    };
  }

  async list(kind: ClosingKindDto, page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      this.prisma.collectionClosing.findMany({
        where: { kind },
        include,
        orderBy: { fromDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.collectionClosing.count({ where: { kind } }),
    ]);
    return { items: items.map(summary), total, page, pageSize };
  }

  async get(id: string): Promise<CollectionClosingDto> {
    const item = await this.prisma.collectionClosing.findUnique({ where: { id }, include });
    if (!item) throw new DomainError('COLLECTION_CLOSING_NOT_FOUND', 'Cierre no encontrado');
    const snapshot = item.snapshot as unknown as ClosingFiguresDto;
    const now = await this.figures('WEEKLY', isoDate(item.fromDate), isoDate(item.toDate));
    // Alumnos y deuda quedan como estaban: solo se comparan los importes.
    const current = { ...now, students: null };
    return { ...summary(item), snapshot, current, changes: closingChanges(snapshot, current) };
  }

  async create(input: CreateClosingDto | null, actorId: string, now = new Date()) {
    const period = closingPeriod(input, this.today(now));
    const figures = await this.figures(period.kind, period.fromDate, period.toDate);
    try {
      const created = await this.prisma.$transaction(
        async (tx) => {
          // Dos cierres del mismo tipo no se superponen: la recaudación se contaría dos veces.
          const overlapping = await tx.collectionClosing.findFirst({
            where: {
              kind: period.kind,
              fromDate: { lte: dateValue(period.toDate) },
              toDate: { gte: dateValue(period.fromDate) },
            },
          });
          if (overlapping)
            throw new DomainError(
              'COLLECTION_CLOSING_OVERLAP_CONFLICT',
              `Ya hay un cierre del ${isoDate(overlapping.fromDate)} al ${isoDate(overlapping.toDate)}.`,
            );
          const closing = await tx.collectionClosing.create({
            data: {
              kind: period.kind,
              fromDate: dateValue(period.fromDate),
              toDate: dateValue(period.toDate),
              snapshot: figures as unknown as Prisma.InputJsonValue,
              createdByUserId: actorId,
            },
            include,
          });
          await tx.auditLog.create({
            data: {
              actorUserId: actorId,
              action: 'CREATE',
              entityType: 'COLLECTION_CLOSING',
              entityId: closing.id,
              after: {
                kind: period.kind,
                fromDate: period.fromDate,
                toDate: period.toDate,
                total: figures.collections.total,
              },
            },
          });
          return closing;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return summary(created);
    } catch (error) {
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') ||
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
      )
        throw new DomainError(
          'COLLECTION_CLOSING_OVERLAP_CONFLICT',
          'Ese período ya se cerró. Actualizá la lista.',
        );
      throw error;
    }
  }

  async pdf(id: string) {
    const closing = await this.get(id);
    return {
      file: await renderClosingPdf(closing, timeZone()),
      fileName: `cierre-${closing.kind === 'WEEKLY' ? 'semanal' : 'mensual'}-${closing.fromDate}_${closing.toDate}.pdf`,
    };
  }
}
