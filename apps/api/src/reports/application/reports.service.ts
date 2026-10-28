import type {
  OperationalReportsDto,
  PaymentMethodDto,
  ReportCashMethodDto,
} from '@academy/contracts';
import { Prisma } from '@academy/database';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { businessDayAt } from '../../dashboard/application/business-day';
import { toCsv } from '../domain/csv';
import { PDF_DEBTOR_LIMIT, renderOperationalReportPdf } from '../domain/report-pdf';

const METHODS: readonly PaymentMethodDto[] = ['CASH', 'MERCADO_PAGO', 'CARD'];
const METHOD_LABELS: Readonly<Record<PaymentMethodDto, string>> = {
  CASH: 'Efectivo',
  MERCADO_PAGO: 'Mercado Pago',
  CARD: 'Tarjeta',
};
const reportCashInclude = {
  user: { select: { id: true, username: true } },
  closingLines: true,
  corrections: true,
  movements: true,
} satisfies Prisma.CashShiftInclude;
type ReportCashShift = Prisma.CashShiftGetPayload<{ include: typeof reportCashInclude }>;
const zero = () => new Prisma.Decimal(0);
const debtCtes = (businessDate: string) => Prisma.sql`
  WITH confirmed AS (
    SELECT pa.monthly_charge_id, SUM(pa.amount) AS paid
    FROM payment_allocations pa
    JOIN payments p ON p.id = pa.payment_id AND p.status = 'CONFIRMED'
    GROUP BY pa.monthly_charge_id
  ), adjustments AS (
    SELECT monthly_charge_id, SUM(student_amount_delta) AS delta,
           BOOL_OR(type = 'LATE_FEE') AS has_late_fee
    FROM monthly_charge_adjustments GROUP BY monthly_charge_id
  ), open_charges AS (
    SELECT mc.student_id, mc.due_date,
      GREATEST(
        GREATEST(mc.base_amount + COALESCE(a.delta, 0), 0)
        + CASE WHEN mc.due_date < ${businessDate}::date AND NOT COALESCE(a.has_late_fee, false)
          AND mc.kind = 'MONTHLY' AND GREATEST(mc.base_amount + COALESCE(a.delta, 0), 0) - COALESCE(c.paid, 0) > 0
          THEN 1000 ELSE 0 END
        - COALESCE(c.paid, 0), 0
      ) AS outstanding
    FROM monthly_charges mc
    LEFT JOIN confirmed c ON c.monthly_charge_id = mc.id
    LEFT JOIN adjustments a ON a.monthly_charge_id = mc.id
    WHERE mc.status <> 'VOID'
  )`;

type DebtSummaryRow = {
  pendingDebt: Prisma.Decimal;
  overdueCharges: bigint;
  overdueDebt: Prisma.Decimal;
};
type StudentRow = {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  status: 'ACTIVE' | 'INACTIVE';
  joinedAt: Date;
  activeEnrollments: bigint;
  currentDebt: Prisma.Decimal;
  total: bigint;
};
type DebtorRow = {
  studentId: string;
  firstName: string;
  lastName: string;
  dni: string;
  openCharges: bigint;
  overdueCharges: bigint;
  totalDebt: Prisma.Decimal;
  overdueDebt: Prisma.Decimal;
  oldestDueDate: Date;
  total: bigint;
};
type AttendanceRow = {
  classId: string;
  className: string;
  teacherName: string;
  records: bigint;
  present: bigint;
  absent: bigint;
  justified: bigint;
};
type DayRow = { date: Date; amount: Prisma.Decimal };
type TeacherIncomeRow = {
  teacherId: string;
  teacherName: string;
  charges: Prisma.Decimal;
  historicalDebt: Prisma.Decimal;
  singleClass: Prisma.Decimal;
  singleClassCount: bigint;
};
type SingleClassRow = {
  classId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  count: bigint;
  amount: Prisma.Decimal;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async operational(input: {
    from: Date;
    toExclusive: Date;
    fromDate: string;
    toDate: string;
    studentStatus?: 'ACTIVE' | 'INACTIVE';
    q?: string;
    classId?: string;
    page: number;
    pageSize: number;
    debtSort: 'highest' | 'oldest';
  }): Promise<OperationalReportsDto> {
    const timezone = process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires';
    const businessDate = businessDayAt(new Date(), timezone).date;
    const offset = (input.page - 1) * input.pageSize;
    const search = input.q?.trim() ? `%${input.q.trim()}%` : null;
    const status = input.studentStatus ?? null;
    const classId = input.classId ?? null;
    const studentFilter = Prisma.sql`
      WHERE (${status}::text IS NULL OR s.status::text = ${status})
        AND (${search}::text IS NULL OR CONCAT_WS(' ', s.first_name, s.last_name) ILIKE ${search} OR s.dni ILIKE ${search})`;

    const [
      studentCounts,
      newStudents,
      debtRows,
      students,
      debtors,
      payments,
      tenders,
      days,
      attendance,
      shifts,
      openShifts,
      byConcept,
      singleClasses,
      byTeacher,
    ] = await Promise.all([
      this.prisma.student.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.student.count({
        where: { createdAt: { gte: input.from, lt: input.toExclusive } },
      }),
      this.prisma.$queryRaw<DebtSummaryRow[]>(Prisma.sql`${debtCtes(businessDate)}
          SELECT COALESCE(SUM(outstanding), 0) AS "pendingDebt",
            COUNT(*) FILTER (WHERE due_date < ${businessDate}::date)::bigint AS "overdueCharges",
            COALESCE(SUM(outstanding) FILTER (WHERE due_date < ${businessDate}::date), 0) AS "overdueDebt"
          FROM open_charges WHERE outstanding > 0`),
      this.prisma.$queryRaw<StudentRow[]>(Prisma.sql`${debtCtes(businessDate)}, student_debt AS (
            SELECT student_id, SUM(outstanding) AS debt FROM open_charges WHERE outstanding > 0 GROUP BY student_id
          ), active_enrollments AS (
            SELECT student_id, COUNT(*)::bigint AS count FROM enrollments WHERE status = 'ACTIVE' GROUP BY student_id
          )
          SELECT s.id, s.first_name AS "firstName", s.last_name AS "lastName", s.dni, s.status,
            s.joined_at AS "joinedAt", COALESCE(e.count, 0)::bigint AS "activeEnrollments",
            COALESCE(d.debt, 0) AS "currentDebt", COUNT(*) OVER()::bigint AS total
          FROM students s LEFT JOIN student_debt d ON d.student_id = s.id
          LEFT JOIN active_enrollments e ON e.student_id = s.id ${studentFilter}
          ORDER BY s.last_name, s.first_name, s.id LIMIT ${input.pageSize} OFFSET ${offset}`),
      this.prisma.$queryRaw<DebtorRow[]>(Prisma.sql`${debtCtes(businessDate)}
          SELECT s.id AS "studentId", s.first_name AS "firstName", s.last_name AS "lastName", s.dni,
            COUNT(*)::bigint AS "openCharges",
            COUNT(*) FILTER (WHERE oc.due_date < ${businessDate}::date)::bigint AS "overdueCharges",
            SUM(oc.outstanding) AS "totalDebt",
            COALESCE(SUM(oc.outstanding) FILTER (WHERE oc.due_date < ${businessDate}::date), 0) AS "overdueDebt",
            MIN(oc.due_date) AS "oldestDueDate", COUNT(*) OVER()::bigint AS total
          FROM open_charges oc JOIN students s ON s.id = oc.student_id WHERE oc.outstanding > 0
          GROUP BY s.id ${input.debtSort === 'oldest' ? Prisma.sql`ORDER BY MIN(oc.due_date), s.id` : Prisma.sql`ORDER BY SUM(oc.outstanding) DESC, s.id`}
          LIMIT ${input.pageSize} OFFSET ${offset}`),
      this.prisma.payment.aggregate({
        where: { status: 'CONFIRMED', paidAt: { gte: input.from, lt: input.toExclusive } },
        _count: { id: true },
        _sum: { amount: true },
      }),
      this.prisma.paymentTender.groupBy({
        by: ['method'],
        where: {
          payment: { status: 'CONFIRMED', paidAt: { gte: input.from, lt: input.toExclusive } },
        },
        _sum: { amount: true },
      }),
      this.prisma.$queryRaw<DayRow[]>(Prisma.sql`
          SELECT DATE(paid_at AT TIME ZONE ${timezone}) AS date, SUM(amount) AS amount
          FROM payments WHERE status = 'CONFIRMED' AND paid_at >= ${input.from} AND paid_at < ${input.toExclusive}
          GROUP BY date ORDER BY date`),
      this.prisma.$queryRaw<AttendanceRow[]>(Prisma.sql`
          SELECT c.id AS "classId", c.name AS "className",
            CONCAT(t.first_name, ' ', t.last_name) AS "teacherName", COUNT(*)::bigint AS records,
            COUNT(*) FILTER (WHERE a.status = 'PRESENT')::bigint AS present,
            COUNT(*) FILTER (WHERE a.status = 'ABSENT')::bigint AS absent,
            COUNT(*) FILTER (WHERE a.status = 'JUSTIFIED')::bigint AS justified
          FROM student_attendances a JOIN enrollments e ON e.id = a.enrollment_id
          JOIN classes c ON c.id = e.class_id JOIN teachers t ON t.id = c.teacher_id
          WHERE a.attendance_date >= ${input.fromDate}::date AND a.attendance_date <= ${input.toDate}::date
            AND (${classId}::uuid IS NULL OR c.id = ${classId}::uuid)
          GROUP BY c.id, t.id ORDER BY c.name`),
      this.prisma.cashShift.findMany({
        where: { status: 'CLOSED', closedAt: { gte: input.from, lt: input.toExclusive } },
        include: reportCashInclude,
        orderBy: { closedAt: 'desc' },
      }),
      this.prisma.cashShift.count({ where: { status: 'OPEN' } }),
      this.prisma.payment.groupBy({
        by: ['kind', 'concept'],
        where: { status: 'CONFIRMED', paidAt: { gte: input.from, lt: input.toExclusive } },
        _sum: { amount: true },
      }),
      // Clases sueltas por clase y por el profesor que la dictó (foto guardada en el cobro).
      this.prisma.$queryRaw<SingleClassRow[]>(Prisma.sql`
          SELECT c.id AS "classId", c.name AS "className", t.id AS "teacherId",
            CONCAT(t.first_name, ' ', t.last_name) AS "teacherName",
            COUNT(*)::bigint AS count, SUM(p.amount) AS amount
          FROM payments p JOIN classes c ON c.id = p.class_id JOIN teachers t ON t.id = p.teacher_id
          WHERE p.status = 'CONFIRMED' AND p.concept = 'SINGLE_CLASS'
            AND p.paid_at >= ${input.from} AND p.paid_at < ${input.toExclusive}
          GROUP BY c.id, t.id ORDER BY t.last_name, t.first_name, c.name`),
      // Ingresos por profesor: lo imputado a cuotas de sus clases (profesor actual de la clase)
      // y las clases sueltas que dictó. Base para la futura liquidación docente.
      this.prisma.$queryRaw<TeacherIncomeRow[]>(Prisma.sql`
          WITH charge_income AS (
            SELECT c.teacher_id,
              COALESCE(SUM(pa.amount) FILTER (WHERE mc.kind = 'MONTHLY'), 0) AS charges,
              COALESCE(SUM(pa.amount) FILTER (WHERE mc.kind = 'HISTORICAL_DEBT'), 0) AS historical
            FROM payment_allocations pa
            JOIN payments p ON p.id = pa.payment_id AND p.status = 'CONFIRMED'
              AND p.paid_at >= ${input.from} AND p.paid_at < ${input.toExclusive}
            JOIN monthly_charges mc ON mc.id = pa.monthly_charge_id
            JOIN enrollments e ON e.id = mc.enrollment_id
            JOIN classes c ON c.id = e.class_id
            GROUP BY c.teacher_id
          ), single_income AS (
            SELECT p.teacher_id, SUM(p.amount) AS amount, COUNT(*)::bigint AS count
            FROM payments p
            WHERE p.status = 'CONFIRMED' AND p.concept = 'SINGLE_CLASS'
              AND p.paid_at >= ${input.from} AND p.paid_at < ${input.toExclusive}
            GROUP BY p.teacher_id
          )
          SELECT t.id AS "teacherId", CONCAT(t.first_name, ' ', t.last_name) AS "teacherName",
            COALESCE(ci.charges, 0) AS charges, COALESCE(ci.historical, 0) AS "historicalDebt",
            COALESCE(si.amount, 0) AS "singleClass", COALESCE(si.count, 0)::bigint AS "singleClassCount"
          FROM teachers t
          LEFT JOIN charge_income ci ON ci.teacher_id = t.id
          LEFT JOIN single_income si ON si.teacher_id = t.id
          WHERE ci.teacher_id IS NOT NULL OR si.teacher_id IS NOT NULL
          ORDER BY t.last_name, t.first_name`),
    ]);
    const conceptTotal = (match: (row: (typeof byConcept)[number]) => boolean) =>
      byConcept
        .filter(match)
        .reduce((sum, row) => sum.plus(row._sum.amount ?? 0), zero())
        .toFixed(2);

    const cash = this.cashReport(shifts);
    const debt = debtRows[0]!;
    const attendanceTotals = attendance.reduce(
      (sum, item) => ({
        records: sum.records + Number(item.records),
        present: sum.present + Number(item.present),
        absent: sum.absent + Number(item.absent),
        justified: sum.justified + Number(item.justified),
      }),
      { records: 0, present: 0, absent: 0, justified: 0 },
    );
    return {
      generatedAt: new Date().toISOString(),
      businessDate,
      from: input.fromDate,
      to: input.toDate,
      summary: {
        activeStudents: studentCounts.find((item) => item.status === 'ACTIVE')?._count.id ?? 0,
        inactiveStudents: studentCounts.find((item) => item.status === 'INACTIVE')?._count.id ?? 0,
        newStudents,
        pendingDebt: debt.pendingDebt.toFixed(2),
        overdueCharges: Number(debt.overdueCharges),
        overdueDebt: debt.overdueDebt.toFixed(2),
        collectedAmount: payments._sum.amount?.toFixed(2) ?? '0.00',
        confirmedPayments: payments._count.id,
        closedCashShifts: shifts.length,
        cashDifference: cash.byMethod
          .reduce((sum, item) => sum.plus(item.correctedDifference), zero())
          .toFixed(2),
      },
      students: {
        items: students.map((item) => ({
          ...item,
          joinedAt: item.joinedAt.toISOString().slice(0, 10),
          activeEnrollments: Number(item.activeEnrollments),
          currentDebt: item.currentDebt.toFixed(2),
          total: undefined,
        })),
        total: Number(students[0]?.total ?? 0),
        page: input.page,
        pageSize: input.pageSize,
      },
      collections: {
        total: payments._sum.amount?.toFixed(2) ?? '0.00',
        count: payments._count.id,
        byMethod: METHODS.map((method) => ({
          method,
          amount: tenders.find((item) => item.method === method)?._sum.amount?.toFixed(2) ?? '0.00',
        })),
        byDay: days.map((item) => ({
          date: item.date.toISOString().slice(0, 10),
          amount: item.amount.toFixed(2),
        })),
        byConcept: {
          charges: conceptTotal((row) => row.kind === 'CHARGES'),
          singleClass: conceptTotal((row) => row.concept === 'SINGLE_CLASS'),
          other: conceptTotal((row) => row.kind === 'OTHER' && row.concept !== 'SINGLE_CLASS'),
        },
        singleClasses: singleClasses.map((item) => ({
          ...item,
          count: Number(item.count),
          amount: item.amount.toFixed(2),
        })),
        byTeacher: byTeacher.map((item) => {
          const charges = new Prisma.Decimal(item.charges);
          const historicalDebt = new Prisma.Decimal(item.historicalDebt);
          const singleClass = new Prisma.Decimal(item.singleClass);
          return {
            teacherId: item.teacherId,
            teacherName: item.teacherName,
            charges: charges.toFixed(2),
            historicalDebt: historicalDebt.toFixed(2),
            singleClass: singleClass.toFixed(2),
            singleClassCount: Number(item.singleClassCount),
            total: charges.plus(historicalDebt).plus(singleClass).toFixed(2),
          };
        }),
      },
      debtors: {
        items: debtors.map((item) => ({
          ...item,
          openCharges: Number(item.openCharges),
          overdueCharges: Number(item.overdueCharges),
          totalDebt: item.totalDebt.toFixed(2),
          overdueDebt: item.overdueDebt.toFixed(2),
          oldestDueDate: item.oldestDueDate.toISOString().slice(0, 10),
          total: undefined,
        })),
        total: Number(debtors[0]?.total ?? 0),
        page: input.page,
        pageSize: input.pageSize,
      },
      attendance: {
        ...attendanceTotals,
        byClass: attendance.map((item) => ({
          ...item,
          records: Number(item.records),
          present: Number(item.present),
          absent: Number(item.absent),
          justified: Number(item.justified),
        })),
      },
      cash: { ...cash, openShifts },
    };
  }

  async pdf(input: Parameters<ReportsService['operational']>[0]) {
    const report = await this.operational({ ...input, page: 1, pageSize: PDF_DEBTOR_LIMIT });
    return renderOperationalReportPdf(report, {
      timezone: process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires',
      debtSort: input.debtSort,
      classFiltered: Boolean(input.classId),
    });
  }

  async export(
    kind: 'students' | 'collections' | 'teachers' | 'debtors' | 'attendance' | 'cash',
    input: Parameters<ReportsService['operational']>[0],
  ) {
    const report = await this.operational({ ...input, page: 1, pageSize: 100000 });
    if (kind === 'students')
      return toCsv(
        ['Nombre', 'Apellido', 'DNI', 'Estado', 'Fecha alta', 'Clases activas', 'Deuda actual'],
        report.students.items.map((item) => [
          item.firstName,
          item.lastName,
          item.dni,
          item.status === 'ACTIVE' ? 'Activo' : 'Inactivo',
          item.joinedAt,
          item.activeEnrollments,
          item.currentDebt,
        ]),
      );
    if (kind === 'teachers')
      return toCsv(
        [
          'Profesor',
          'Cuotas',
          'Deuda anterior',
          'Clases sueltas (cantidad)',
          'Clases sueltas',
          'Total',
          'Desde',
          'Hasta',
        ],
        report.collections.byTeacher.map((item) => [
          item.teacherName,
          item.charges,
          item.historicalDebt,
          item.singleClassCount,
          item.singleClass,
          item.total,
          report.from,
          report.to,
        ]),
      );
    if (kind === 'debtors')
      return toCsv(
        [
          'Alumno',
          'DNI',
          'Cuotas abiertas',
          'Cuotas vencidas',
          'Deuda actual',
          'Deuda vencida',
          'Vencimiento más antiguo',
        ],
        report.debtors.items.map((item) => [
          `${item.firstName} ${item.lastName}`,
          item.dni,
          item.openCharges,
          item.overdueCharges,
          item.totalDebt,
          item.overdueDebt,
          item.oldestDueDate,
        ]),
      );
    if (kind === 'attendance')
      return toCsv(
        [
          'Clase',
          'Profesor actual',
          'Registros',
          'Presentes',
          'Ausentes',
          'Justificados',
          'Desde',
          'Hasta',
        ],
        report.attendance.byClass.map((item) => [
          item.className,
          item.teacherName,
          item.records,
          item.present,
          item.absent,
          item.justified,
          report.from,
          report.to,
        ]),
      );
    if (kind === 'cash')
      return toCsv(
        [
          'Medio',
          'Esperado',
          'Declarado',
          'Diferencia',
          'Declarado corregido',
          'Diferencia corregida',
          'Desde',
          'Hasta',
        ],
        report.cash.byMethod.map((item) => [
          METHOD_LABELS[item.method],
          item.expected,
          item.declared,
          item.difference,
          item.correctedDeclared,
          item.correctedDifference,
          report.from,
          report.to,
        ]),
      );
    const payments = await this.prisma.payment.findMany({
      where: { status: 'CONFIRMED', paidAt: { gte: input.from, lt: input.toExclusive } },
      include: { student: true, tenders: true, academicClass: true, teacher: true },
      orderBy: [{ paidAt: 'asc' }, { id: 'asc' }],
    });
    const concept = (payment: (typeof payments)[number]) =>
      payment.kind === 'CHARGES'
        ? 'Cuotas'
        : payment.concept === 'SINGLE_CLASS'
          ? 'Clase suelta'
          : `Otro: ${payment.conceptDetail ?? ''}`;
    return toCsv(
      [
        'Fecha',
        'Alumno',
        'DNI',
        'Concepto',
        'Clase',
        'Profesor',
        'Monto total',
        'Efectivo',
        'Mercado Pago',
        'Tarjeta',
      ],
      payments.map((payment) => [
        payment.paidAt.toISOString(),
        `${payment.student.firstName} ${payment.student.lastName}`,
        payment.student.dni,
        concept(payment),
        payment.academicClass?.name ?? '',
        payment.teacher ? `${payment.teacher.firstName} ${payment.teacher.lastName}` : '',
        payment.amount.toFixed(2),
        payment.tenders.find((item) => item.method === 'CASH')?.amount.toFixed(2) ?? '0.00',
        payment.tenders.find((item) => item.method === 'MERCADO_PAGO')?.amount.toFixed(2) ?? '0.00',
        payment.tenders.find((item) => item.method === 'CARD')?.amount.toFixed(2) ?? '0.00',
      ]),
    );
  }

  private cashReport(shifts: readonly ReportCashShift[]) {
    const byMethod: ReportCashMethodDto[] = METHODS.map((method) => {
      let expected = zero(),
        declared = zero(),
        corrected = zero(),
        currentExpected = zero();
      for (const shift of shifts) {
        const line = shift.closingLines.find((item) => item.method === method);
        if (!line) continue;
        expected = expected.plus(line.expectedAmount);
        declared = declared.plus(line.declaredAmount);
        corrected = corrected.plus(
          shift.corrections
            .filter((item) => item.method === method)
            .reduce((sum, item) => sum.plus(item.amountDelta), line.declaredAmount),
        );
        currentExpected = currentExpected.plus(
          shift.movements
            .filter((item) => item.method === method)
            .reduce(
              (sum, item) =>
                sum.plus(item.type === 'REVERSAL' ? item.amount.negated() : item.amount),
              zero(),
            ),
        );
      }
      return {
        method,
        expected: expected.toFixed(2),
        declared: declared.toFixed(2),
        difference: declared.minus(expected).toFixed(2),
        correctedDeclared: corrected.toFixed(2),
        correctedDifference: corrected.minus(currentExpected).toFixed(2),
      };
    });
    const operators = new Map<
      string,
      {
        userId: string;
        username: string;
        shifts: number;
        expected: Prisma.Decimal;
        declared: Prisma.Decimal;
        corrected: Prisma.Decimal;
      }
    >();
    const differences = [];
    for (const shift of shifts) {
      const expected = shift.closingLines.reduce(
        (sum, item) => sum.plus(item.expectedAmount),
        zero(),
      );
      const declared = shift.closingLines.reduce(
        (sum, item) => sum.plus(item.declaredAmount),
        zero(),
      );
      const corrected = shift.closingLines.reduce(
        (sum, line) =>
          sum.plus(
            shift.corrections
              .filter((item) => item.method === line.method)
              .reduce((value, item) => value.plus(item.amountDelta), line.declaredAmount),
          ),
        zero(),
      );
      const current = shift.movements.reduce(
        (sum, item) => sum.plus(item.type === 'REVERSAL' ? item.amount.negated() : item.amount),
        zero(),
      );
      const item = operators.get(shift.userId) ?? {
        userId: shift.userId,
        username: shift.user.username,
        shifts: 0,
        expected: zero(),
        declared: zero(),
        corrected: zero(),
      };
      item.shifts += 1;
      item.expected = item.expected.plus(expected);
      item.declared = item.declared.plus(declared);
      item.corrected = item.corrected.plus(corrected.minus(current));
      operators.set(shift.userId, item);
      if (!declared.equals(expected) || !corrected.equals(current))
        differences.push({
          shiftId: shift.id,
          closedAt: shift.closedAt!.toISOString(),
          username: shift.user.username,
          difference: declared.minus(expected).toFixed(2),
          correctedDifference: corrected.minus(current).toFixed(2),
        });
    }
    return {
      closedShifts: shifts.length,
      byMethod,
      byOperator: [...operators.values()].map((item) => ({
        userId: item.userId,
        username: item.username,
        shifts: item.shifts,
        expected: item.expected.toFixed(2),
        declared: item.declared.toFixed(2),
        difference: item.declared.minus(item.expected).toFixed(2),
        correctedDifference: item.corrected.toFixed(2),
      })),
      differences,
    };
  }
}
