import type { MonthlyBoardDto, PaymentMethodDto } from '@academy/contracts';
import { Prisma } from '@academy/database';
import { Injectable } from '@nestjs/common';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { hasPermissions } from '../../auth/domain/permissions';
import { PrismaService } from '../../database/prisma.service';
import { debtCtes } from '../../reports/application/reports.service';
import { CONCEPT_LABELS } from '../../reports/domain/report-pdf';
import { END_REASON_LABELS, boardMonth, boardMonths, percentOf } from '../domain/monthly-board';
import { businessDayAt } from './business-day';
import { PAYMENT_METHOD_LABELS } from '../../shared/domain/format';

const timeZone = () => process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires';
const zero = () => new Prisma.Decimal(0);

type MovementRow = Readonly<{
  month: string;
  activeStudents: bigint;
  newStudents: bigint;
  dropped: bigint;
}>;
type ClassEnrollmentRow = Readonly<{
  classId: string;
  enrolled: bigint;
  started: bigint;
  ended: bigint;
}>;
type ClassAttendanceRow = Readonly<{ classId: string; records: bigint; present: bigint }>;
type ClassAmountRow = Readonly<{ classId: string; amount: Prisma.Decimal }>;
type OverdueRow = Readonly<{ students: bigint; amount: Prisma.Decimal }>;
type MonthChargesRow = Readonly<{
  paidAmount: Prisma.Decimal;
  paidCount: bigint;
  openAmount: Prisma.Decimal;
  openCount: bigint;
  overdueAmount: Prisma.Decimal;
  overdueCount: bigint;
}>;

/**
 * Tablero mensual. Alumnos, clases y potenciales los ve quien gestiona alumnos (también Admisión);
 * los importes solo viajan con `reports:operational` (Administración y Dirección).
 */
@Injectable()
export class MonthlyBoardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(user: PublicAuthUser, monthValue: string | undefined, now: Date) {
    const today = businessDayAt(now, timeZone()).date;
    const months = boardMonths(boardMonth(monthValue, today), today);
    const selected = months.at(-1)!;
    const previous = months.at(-2)!;
    const withMoney = hasPermissions(user, ['reports:operational']);
    // Inicio del día en Buenos Aires, como instante.
    const instant = (date: string) =>
      businessDayAt(new Date(`${date}T15:00:00.000Z`), timeZone()).start;
    const monthStart = instant(selected.fromDate);
    const monthEnd = instant(selected.nextDate);
    const paidInMonth = { status: 'CONFIRMED' as const, paidAt: { gte: monthStart, lt: monthEnd } };
    const leadsIn = (from: string, next: string) => ({
      createdAt: { gte: instant(from), lt: instant(next) },
    });

    const [
      movement,
      dropReasons,
      classes,
      classEnrollments,
      classAttendance,
      overdueRows,
      inquiries,
      trials,
      enrolled,
      previousInquiries,
      previousEnrolled,
    ] = await Promise.all([
      // Alta = primera inscripción del alumno; baja = terminó su última inscripción.
      this.prisma.$queryRaw<MovementRow[]>(Prisma.sql`
        WITH per_student AS (
          SELECT student_id, MIN(start_date) AS first_start,
                 MAX(COALESCE(end_date, 'infinity'::date)) AS last_end
          FROM enrollments GROUP BY student_id
        )
        SELECT m.month,
          (SELECT COUNT(DISTINCT e.student_id) FROM enrollments e
            WHERE e.start_date <= m.ref_date
              AND (e.end_date IS NULL OR e.end_date >= m.ref_date))::bigint AS "activeStudents",
          (SELECT COUNT(*) FROM per_student ps
            WHERE ps.first_start BETWEEN m.from_date AND m.to_date)::bigint AS "newStudents",
          (SELECT COUNT(*) FROM per_student ps
            WHERE ps.last_end BETWEEN m.from_date AND m.to_date
              AND ps.last_end < ${today}::date)::bigint AS dropped
        FROM (VALUES ${Prisma.join(
          months.map(
            (item) =>
              Prisma.sql`(${item.month}::text, ${item.fromDate}::date, ${item.toDate}::date, ${item.refDate}::date)`,
          ),
        )}) AS m(month, from_date, to_date, ref_date)
        ORDER BY m.month`),
      this.prisma.$queryRaw<{ reason: string; count: bigint }[]>(Prisma.sql`
        WITH last_enrollment AS (
          SELECT DISTINCT ON (student_id) student_id, end_date, end_reason
          FROM enrollments
          ORDER BY student_id, COALESCE(end_date, 'infinity'::date) DESC, created_at DESC
        )
        SELECT COALESCE(end_reason::text, 'UNSPECIFIED') AS reason, COUNT(*)::bigint AS count
        FROM last_enrollment
        WHERE end_date BETWEEN ${selected.fromDate}::date AND ${selected.toDate}::date
          AND end_date < ${today}::date
        GROUP BY 1 ORDER BY 2 DESC, 1`),
      this.prisma.academyClass.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          capacity: true,
          teacher: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.$queryRaw<ClassEnrollmentRow[]>(Prisma.sql`
        SELECT class_id AS "classId",
          COUNT(*) FILTER (WHERE start_date <= ${selected.refDate}::date
            AND (end_date IS NULL OR end_date >= ${selected.refDate}::date))::bigint AS enrolled,
          COUNT(*) FILTER (WHERE start_date BETWEEN ${selected.fromDate}::date
            AND ${selected.toDate}::date)::bigint AS started,
          COUNT(*) FILTER (WHERE end_date BETWEEN ${selected.fromDate}::date
            AND ${selected.toDate}::date AND end_date < ${today}::date)::bigint AS ended
        FROM enrollments GROUP BY class_id`),
      this.prisma.$queryRaw<ClassAttendanceRow[]>(Prisma.sql`
        SELECT e.class_id AS "classId", COUNT(*)::bigint AS records,
          COUNT(*) FILTER (WHERE a.status = 'PRESENT')::bigint AS present
        FROM student_attendances a JOIN enrollments e ON e.id = a.enrollment_id
        WHERE a.attendance_date BETWEEN ${selected.fromDate}::date AND ${selected.toDate}::date
        GROUP BY e.class_id`),
      this.prisma.$queryRaw<OverdueRow[]>(Prisma.sql`${debtCtes(today)}
        SELECT COUNT(DISTINCT student_id)::bigint AS students,
          COALESCE(SUM(outstanding), 0) AS amount
        FROM open_charges WHERE outstanding > 0 AND due_date < ${today}::date`),
      this.prisma.lead.count({ where: leadsIn(selected.fromDate, selected.nextDate) }),
      this.prisma.lead.count({
        where: {
          ...leadsIn(selected.fromDate, selected.nextDate),
          OR: [{ trialClasses: { some: {} } }, { status: { in: ['TRIAL', 'ENROLLED'] } }],
        },
      }),
      this.prisma.lead.count({
        where: { ...leadsIn(selected.fromDate, selected.nextDate), status: 'ENROLLED' },
      }),
      this.prisma.lead.count({ where: leadsIn(previous.fromDate, previous.nextDate) }),
      this.prisma.lead.count({
        where: { ...leadsIn(previous.fromDate, previous.nextDate), status: 'ENROLLED' },
      }),
    ]);

    const money = withMoney
      ? await this.money(months[0]!.fromDate, selected, today, instant, paidInMonth)
      : null;
    const amountFor = (rows: readonly ClassAmountRow[] | undefined, classId: string) =>
      rows?.find((row) => row.classId === classId)?.amount ?? zero();

    const result: MonthlyBoardDto = {
      generatedAt: now.toISOString(),
      businessDate: today,
      month: selected.month,
      label: selected.label,
      inProgress: selected.toDate >= today,
      history: months.map((item) => {
        const row = movement.find((entry) => entry.month === item.month);
        return {
          month: item.month,
          label: item.label,
          shortLabel: item.shortLabel,
          activeStudents: Number(row?.activeStudents ?? 0),
          newStudents: Number(row?.newStudents ?? 0),
          dropped: Number(row?.dropped ?? 0),
          ...(money && {
            collected: (money.collectedByMonth.get(item.month) ?? zero()).toFixed(2),
          }),
        };
      }),
      dropReasons: dropReasons.map((row) => ({
        reason: row.reason,
        label: END_REASON_LABELS[row.reason] ?? row.reason,
        count: Number(row.count),
      })),
      overdueStudents: Number(overdueRows[0]?.students ?? 0),
      classes: classes
        .map((item) => {
          const enrollment = classEnrollments.find((row) => row.classId === item.id);
          const attendance = classAttendance.find((row) => row.classId === item.id);
          return {
            id: item.id,
            name: item.name,
            teacher: `${item.teacher.firstName} ${item.teacher.lastName}`,
            capacity: item.capacity,
            enrolled: Number(enrollment?.enrolled ?? 0),
            started: Number(enrollment?.started ?? 0),
            ended: Number(enrollment?.ended ?? 0),
            attendancePercent: percentOf(
              Number(attendance?.present ?? 0),
              Number(attendance?.records ?? 0),
            ),
            ...(money && {
              collected: amountFor(money.collectedByClass, item.id)
                .plus(amountFor(money.singleByClass, item.id))
                .toFixed(2),
              overdue: amountFor(money.overdueByClass, item.id).toFixed(2),
            }),
          };
        })
        // De menor a mayor ocupación: las que necesitan alumnos, primero.
        .sort(
          (left, right) =>
            left.enrolled / Math.max(left.capacity, 1) -
              right.enrolled / Math.max(right.capacity, 1) ||
            left.name.localeCompare(right.name, 'es'),
        ),
      leads: { inquiries, trials, enrolled, previousInquiries, previousEnrolled },
      ...(money && {
        money: {
          overdueDebt: (overdueRows[0]?.amount ?? zero()).toFixed(2),
          charges: money.charges,
          byMethod: money.byMethod,
          byConcept: money.byConcept,
        },
      }),
    };
    return result;
  }

  private async money(
    historyFromDate: string,
    selected: Readonly<{ fromDate: string; toDate: string; nextDate: string }>,
    today: string,
    instant: (date: string) => Date,
    paidInMonth: Prisma.PaymentWhereInput,
  ) {
    const monthStart = instant(selected.fromDate);
    const monthEnd = instant(selected.nextDate);
    const [collected, chargeRows, tenders, concepts, collectedByClass, singles, overdueByClass] =
      await Promise.all([
        this.prisma.$queryRaw<{ month: string; amount: Prisma.Decimal }[]>(Prisma.sql`
          SELECT to_char(paid_at AT TIME ZONE ${timeZone()}, 'YYYY-MM') AS month,
            SUM(amount) AS amount
          FROM payments
          WHERE status = 'CONFIRMED' AND paid_at >= ${instant(historyFromDate)}
            AND paid_at < ${monthEnd}
          GROUP BY 1`),
        this.prisma.$queryRaw<MonthChargesRow[]>(Prisma.sql`${debtCtes(today)}
          SELECT COALESCE(SUM(paid), 0) AS "paidAmount",
            COUNT(*) FILTER (WHERE outstanding = 0)::bigint AS "paidCount",
            COALESCE(SUM(outstanding) FILTER (WHERE due_date >= ${today}::date), 0)
              AS "openAmount",
            COUNT(*) FILTER (WHERE outstanding > 0 AND due_date >= ${today}::date)::bigint
              AS "openCount",
            COALESCE(SUM(outstanding) FILTER (WHERE due_date < ${today}::date), 0)
              AS "overdueAmount",
            COUNT(*) FILTER (WHERE outstanding > 0 AND due_date < ${today}::date)::bigint
              AS "overdueCount"
          FROM open_charges
          WHERE kind = 'MONTHLY'
            AND period BETWEEN ${selected.fromDate}::date AND ${selected.toDate}::date`),
        this.prisma.paymentTender.groupBy({
          by: ['method'],
          where: { payment: paidInMonth },
          _sum: { amount: true },
        }),
        this.prisma.payment.groupBy({
          by: ['kind', 'concept', 'conceptId'],
          where: paidInMonth,
          _sum: { amount: true },
        }),
        // Lo imputado a cuotas de cada clase por pagos del mes (criterio de caja).
        this.prisma.$queryRaw<ClassAmountRow[]>(Prisma.sql`
          SELECT e.class_id AS "classId", SUM(pa.amount) AS amount
          FROM payment_allocations pa
          JOIN payments p ON p.id = pa.payment_id AND p.status = 'CONFIRMED'
            AND p.paid_at >= ${monthStart} AND p.paid_at < ${monthEnd}
          JOIN monthly_charges mc ON mc.id = pa.monthly_charge_id
          JOIN enrollments e ON e.id = mc.enrollment_id
          GROUP BY e.class_id`),
        this.prisma.payment.groupBy({
          by: ['classId'],
          where: { ...paidInMonth, concept: 'SINGLE_CLASS', classId: { not: null } },
          _sum: { amount: true },
        }),
        this.prisma.$queryRaw<ClassAmountRow[]>(Prisma.sql`${debtCtes(today)}
          SELECT e.class_id AS "classId", SUM(oc.outstanding) AS amount
          FROM open_charges oc JOIN enrollments e ON e.id = oc.enrollment_id
          WHERE oc.outstanding > 0 AND oc.due_date < ${today}::date
          GROUP BY e.class_id`),
      ]);
    const conceptIds = concepts.flatMap((row) => (row.conceptId ? [row.conceptId] : []));
    const catalog = conceptIds.length
      ? await this.prisma.paymentConcept.findMany({
          where: { id: { in: conceptIds } },
          select: { id: true, name: true },
        })
      : [];
    // Cuotas, clase suelta y recargo con su nombre fijo; el resto, por concepto del catálogo.
    const byConcept = new Map<string, { key: string; label: string; amount: Prisma.Decimal }>();
    for (const row of concepts) {
      const fixed =
        row.kind === 'CHARGES'
          ? 'CHARGES'
          : row.concept === 'SINGLE_CLASS' || row.concept === 'CARD_SURCHARGE' || !row.conceptId
            ? (row.concept ?? 'OTHER')
            : null;
      const key = fixed ?? row.conceptId!;
      const label = fixed
        ? (CONCEPT_LABELS[fixed] ?? 'Otros')
        : (catalog.find((item) => item.id === row.conceptId)?.name ?? 'Otros');
      const current = byConcept.get(key) ?? { key, label, amount: zero() };
      byConcept.set(key, { ...current, amount: current.amount.plus(row._sum.amount ?? 0) });
    }
    const charges = chargeRows[0];
    const paidAmount = charges?.paidAmount ?? zero();
    const openAmount = charges?.openAmount ?? zero();
    const overdueAmount = charges?.overdueAmount ?? zero();
    const sorted = <T extends { amount: Prisma.Decimal }>(items: readonly T[]) =>
      [...items].filter((item) => !item.amount.isZero()).sort((a, b) => b.amount.cmp(a.amount));
    return {
      collectedByMonth: new Map(collected.map((row) => [row.month, row.amount] as const)),
      charges: {
        total: paidAmount.plus(openAmount).plus(overdueAmount).toFixed(2),
        paidAmount: paidAmount.toFixed(2),
        paidCount: Number(charges?.paidCount ?? 0),
        openAmount: openAmount.toFixed(2),
        openCount: Number(charges?.openCount ?? 0),
        overdueAmount: overdueAmount.toFixed(2),
        overdueCount: Number(charges?.overdueCount ?? 0),
      },
      byMethod: sorted(
        tenders.map((row) => ({
          method: row.method as PaymentMethodDto,
          label: PAYMENT_METHOD_LABELS[row.method as PaymentMethodDto],
          amount: row._sum.amount ?? zero(),
        })),
      ).map((row) => ({ ...row, amount: row.amount.toFixed(2) })),
      byConcept: sorted([...byConcept.values()]).map((row) => ({
        ...row,
        amount: row.amount.toFixed(2),
      })),
      collectedByClass,
      singleByClass: singles.flatMap((row) =>
        row.classId ? [{ classId: row.classId, amount: row._sum.amount ?? zero() }] : [],
      ),
      overdueByClass,
    };
  }
}
