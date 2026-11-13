import type {
  MessageRecipientDto,
  MessageRecipientsDto,
  MessageSituationDto,
  MessageSituationSummaryDto,
  MessageTemplateDto,
  RegisterMessageSendDto,
  SaveMessageTemplateDto,
} from '@academy/contracts';
import { Prisma } from '@academy/database';
import { Injectable } from '@nestjs/common';
import { businessDayAt } from '../../dashboard/application/business-day';
import { PrismaService } from '../../database/prisma.service';
import { debtCtes } from '../../reports/application/reports.service';
import { DomainError } from '../../shared/domain/domain-error';
import { parseUuid } from '../../shared/presentation/request-validation';
import { FOLLOW_UP_MIN_ABSENCES } from '../../students/domain/student-follow-up';
import { followUpCte } from '../../students/infrastructure/student-follow-up-query';
import {
  SITUATIONS,
  addDays,
  chargesLabel,
  daysUntilBirthday,
  parseSituation,
  validateTemplate,
} from '../domain/message-template';
import { formatDayMonth, formatMoney } from '../../shared/domain/format';

/** Lo que cada situación sabe de una persona antes de sumarle el último envío. */
type Recipient = Omit<MessageRecipientDto, 'lastSend'>;
type StudentRow = Readonly<{
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
}>;
type ChargeRow = StudentRow &
  Readonly<{ charges: number; amount: Prisma.Decimal; dueDate: Date; total: Prisma.Decimal }>;
type ClassRow = StudentRow & Readonly<{ className: string; date: Date }>;
type AbsenceRow = StudentRow & Readonly<{ className: string; absences: number }>;
type TemplateRow = Prisma.MessageTemplateGetPayload<object>;

const DUE_SOON_DAYS = 5;
const DROPPED_DAYS = 60;
const WELCOME_DAYS = 30;
const BIRTHDAY_DAYS = 7;
/** Un envío cuenta como "ya avisado" durante este tiempo. */
const RECENT_SEND_DAYS = 30;

const timeZone = () => process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires';
const amount = (value: Prisma.Decimal) => formatMoney(value.toFixed(2));
const isoDate = (value: Date) => value.toISOString().slice(0, 10);
const mapTemplate = (item: TemplateRow): MessageTemplateDto => ({
  id: item.id,
  situation: item.situation,
  name: item.name,
  body: item.body,
  status: item.status,
});
const student = (
  row: StudentRow,
  detail: string,
  variables: Readonly<Record<string, string>>,
): Recipient => ({
  kind: 'STUDENT',
  id: row.id,
  name: `${row.firstName} ${row.lastName}`,
  phone: row.phone,
  detail,
  variables: { nombre: row.firstName.trim().split(/\s+/)[0] ?? row.firstName, ...variables },
});

/**
 * Mensajes de WhatsApp por situación: arma la lista de destinatarios de cada una con los datos
 * para completar el mensaje, guarda los mensajes predeterminados y registra a quién se le envió.
 * El sistema no envía nada: quien avisa abre WhatsApp con el texto ya escrito.
 */
@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  private today(now: Date) {
    return businessDayAt(now, timeZone()).date;
  }

  async situations(now = new Date()): Promise<MessageSituationSummaryDto[]> {
    const today = this.today(now);
    const counts = await Promise.all(
      SITUATIONS.map(async (item) => (await this.find(item.situation, today)).length),
    );
    return SITUATIONS.map((item, index) => ({ ...item, count: counts[index]! }));
  }

  async recipients(situationValue: unknown, now = new Date()): Promise<MessageRecipientsDto> {
    const situation = parseSituation(situationValue);
    const today = this.today(now);
    const [found, sends, templates] = await Promise.all([
      this.find(situation, today),
      this.prisma.messageSend.findMany({
        where: {
          situation,
          createdAt: { gte: new Date(now.getTime() - RECENT_SEND_DAYS * 86_400_000) },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          studentId: true,
          leadId: true,
          createdAt: true,
          sentBy: { select: { username: true } },
          template: { select: { name: true } },
        },
      }),
      this.prisma.messageTemplate.findMany({
        where: { situation, status: 'ACTIVE' },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);
    // El más reciente de cada destinatario (vienen ordenados del último al primero).
    const lastSends = new Map<string, MessageRecipientDto['lastSend']>();
    for (const send of sends) {
      const key = send.studentId ?? send.leadId!;
      if (!lastSends.has(key))
        lastSends.set(key, {
          sentAt: send.createdAt.toISOString(),
          sentBy: send.sentBy.username,
          templateName: send.template?.name ?? null,
        });
    }
    return {
      situation,
      businessDate: today,
      recipients: found.map((item) => ({ ...item, lastSend: lastSends.get(item.id) ?? null })),
      templates: templates.map(mapTemplate),
    };
  }

  private find(situation: MessageSituationDto, today: string): Promise<Recipient[]> {
    switch (situation) {
      case 'CHARGE_DUE_SOON':
        return this.charges(today, false);
      case 'CHARGE_OVERDUE':
        return this.charges(today, true);
      case 'ABSENCES':
        return this.absences();
      case 'DROPPED':
        return this.dropped(today);
      case 'WELCOME':
        return this.welcome(today);
      case 'BIRTHDAY':
        return this.birthdays(today);
      case 'LEAD_NO_TRIAL':
        return this.leads(false);
      case 'LEAD_TRIAL_NOT_ENROLLED':
        return this.leads(true);
    }
  }

  /** Cuotas con saldo: vencidas hoy o que vencen en los próximos días. */
  private async charges(today: string, overdue: boolean): Promise<Recipient[]> {
    const matches = overdue
      ? Prisma.sql`oc.due_date < ${today}::date`
      : Prisma.sql`oc.due_date >= ${today}::date AND oc.due_date <= ${addDays(today, DUE_SOON_DAYS)}::date`;
    const rows = await this.prisma.$queryRaw<ChargeRow[]>(Prisma.sql`${debtCtes(today)}
      SELECT s.id, s.first_name AS "firstName", s.last_name AS "lastName", s.phone,
        COUNT(*) FILTER (WHERE ${matches})::int AS charges,
        COALESCE(SUM(oc.outstanding) FILTER (WHERE ${matches}), 0) AS amount,
        MIN(oc.due_date) FILTER (WHERE ${matches}) AS "dueDate",
        SUM(oc.outstanding) AS total
      FROM open_charges oc JOIN students s ON s.id = oc.student_id
      WHERE oc.outstanding > 0
      GROUP BY s.id
      HAVING COUNT(*) FILTER (WHERE ${matches}) > 0`);
    return rows
      .map((row) => ({ row, due: isoDate(row.dueDate) }))
      .sort(
        (left, right) =>
          left.due.localeCompare(right.due) ||
          left.row.lastName.localeCompare(right.row.lastName, 'es'),
      )
      .map(({ row, due }) =>
        student(
          row,
          `${chargesLabel(row.charges)} · ${amount(row.amount)} · ${overdue ? 'venció' : 'vence'} el ${formatDayMonth(due)}`,
          overdue
            ? {
                cuotas: chargesLabel(row.charges),
                saldo_vencido: amount(row.amount),
                vencimiento: formatDayMonth(due),
                saldo_total: amount(row.total),
              }
            : {
                cuotas: chargesLabel(row.charges),
                saldo: amount(row.amount),
                vencimiento: formatDayMonth(due),
              },
        ),
      );
  }

  /** La misma regla que Seguimiento: ausencias seguidas en una inscripción activa. */
  private async absences(): Promise<Recipient[]> {
    const rows = await this.prisma.$queryRaw<AbsenceRow[]>(Prisma.sql`${followUpCte()}
      SELECT s.id, s.first_name AS "firstName", s.last_name AS "lastName", s.phone,
        c."className", c."consecutiveAbsences" AS absences
      FROM cases c JOIN students s ON s.id = c."studentId"
      WHERE c."consecutiveAbsences" >= ${FOLLOW_UP_MIN_ABSENCES}
      ORDER BY c."consecutiveAbsences" DESC, s.last_name, s.first_name`);
    // Un alumno con ausencias en varias clases aparece una vez, por la que más faltó.
    const seen = new Set<string>();
    return rows
      .filter((row) => !seen.has(row.id) && seen.add(row.id))
      .map((row) =>
        student(row, `${row.absences} ausencias seguidas en ${row.className}`, {
          clase: row.className,
          ausencias: String(row.absences),
        }),
      );
  }

  private async dropped(today: string): Promise<Recipient[]> {
    const rows = await this.prisma.$queryRaw<ClassRow[]>(Prisma.sql`
      WITH last_enrollment AS (
        SELECT DISTINCT ON (e.student_id) e.student_id, e.end_date, c.name AS class_name
        FROM enrollments e JOIN classes c ON c.id = e.class_id
        ORDER BY e.student_id, COALESCE(e.end_date, 'infinity'::date) DESC, e.created_at DESC
      )
      SELECT s.id, s.first_name AS "firstName", s.last_name AS "lastName", s.phone,
        le.class_name AS "className", le.end_date AS date
      FROM last_enrollment le JOIN students s ON s.id = le.student_id
      WHERE le.end_date >= ${addDays(today, -DROPPED_DAYS)}::date AND le.end_date < ${today}::date
      ORDER BY le.end_date DESC, s.last_name, s.first_name`);
    return rows.map((row) =>
      student(row, `Dejó ${row.className} el ${formatDayMonth(isoDate(row.date))}`, {
        clase: row.className,
      }),
    );
  }

  private async welcome(today: string): Promise<Recipient[]> {
    const rows = await this.prisma.$queryRaw<ClassRow[]>(Prisma.sql`
      WITH first_enrollment AS (
        SELECT DISTINCT ON (e.student_id) e.student_id, e.start_date, c.name AS class_name
        FROM enrollments e JOIN classes c ON c.id = e.class_id
        ORDER BY e.student_id, e.start_date, e.created_at
      )
      SELECT s.id, s.first_name AS "firstName", s.last_name AS "lastName", s.phone,
        fe.class_name AS "className", fe.start_date AS date
      FROM first_enrollment fe JOIN students s ON s.id = fe.student_id
      WHERE fe.start_date >= ${addDays(today, -WELCOME_DAYS)}::date
        AND fe.start_date <= ${today}::date
        AND EXISTS (
          SELECT 1 FROM enrollments a WHERE a.student_id = s.id AND a.status = 'ACTIVE'
        )
      ORDER BY fe.start_date DESC, s.last_name, s.first_name`);
    return rows.map((row) =>
      student(row, `Empezó ${row.className} el ${formatDayMonth(isoDate(row.date))}`, {
        clase: row.className,
      }),
    );
  }

  private async birthdays(today: string): Promise<Recipient[]> {
    const students = await this.prisma.student.findMany({
      where: { status: 'ACTIVE', birthDate: { not: null } },
      select: { id: true, firstName: true, lastName: true, phone: true, birthDate: true },
    });
    return students
      .map((item) => ({ item, days: daysUntilBirthday(isoDate(item.birthDate!), today) }))
      .filter(({ days }) => days <= BIRTHDAY_DAYS)
      .sort(
        (left, right) =>
          left.days - right.days || left.item.lastName.localeCompare(right.item.lastName, 'es'),
      )
      .map(({ item, days }) =>
        student(
          item,
          days === 0 ? 'Cumple hoy' : `Cumple el ${formatDayMonth(addDays(today, days))}`,
          {},
        ),
      );
  }

  /** Potenciales abiertos: sin clase de prueba, o con prueba y sin inscribirse. */
  private async leads(withTrial: boolean): Promise<Recipient[]> {
    const leads = await this.prisma.lead.findMany({
      where: withTrial
        ? { status: { in: ['INQUIRY', 'INTERESTED', 'TRIAL'] }, trialClasses: { some: {} } }
        : { status: { in: ['INQUIRY', 'INTERESTED'] }, trialClasses: { none: {} } },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: {
        id: true,
        name: true,
        phone: true,
        createdAt: true,
        trialClasses: {
          orderBy: { trialDate: 'desc' },
          take: 1,
          select: { trialDate: true, academicClass: { select: { name: true } } },
        },
      },
    });
    return leads.map((lead) => {
      const trial = lead.trialClasses[0];
      return {
        kind: 'LEAD' as const,
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        detail: trial
          ? `Probó ${trial.academicClass.name} el ${formatDayMonth(isoDate(trial.trialDate))}`
          : `Consultó el ${formatDayMonth(businessDayAt(lead.createdAt, timeZone()).date)}`,
        variables: {
          nombre: lead.name.trim().split(/\s+/)[0] ?? lead.name,
          ...(trial && { clase: trial.academicClass.name }),
        },
      };
    });
  }

  async createTemplate(input: SaveMessageTemplateDto | null, actorId: string) {
    const situation = parseSituation(input?.situation);
    const data = validateTemplate(input ?? {}, situation);
    const created = await this.prisma.$transaction(async (tx) => {
      const last = await tx.messageTemplate.aggregate({
        where: { situation },
        _max: { sortOrder: true },
      });
      const template = await tx.messageTemplate.create({
        data: { situation, ...data, sortOrder: (last._max.sortOrder ?? 0) + 10 },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: 'CREATE',
          entityType: 'MESSAGE_TEMPLATE',
          entityId: template.id,
          after: { situation, name: template.name, body: template.body },
        },
      });
      return template;
    });
    return mapTemplate(created);
  }

  /** Cambia nombre y texto, o da de baja el mensaje (no se borra: tiene envíos registrados). */
  async updateTemplate(id: string, input: SaveMessageTemplateDto | null, actorId: string) {
    if (input?.status !== undefined && input.status !== 'ACTIVE' && input.status !== 'INACTIVE')
      throw new DomainError('VALIDATION_ERROR', 'Estado inválido', { field: 'status' });
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.messageTemplate.findUnique({ where: { id } });
      if (!current) throw new DomainError('MESSAGE_TEMPLATE_NOT_FOUND', 'Mensaje no encontrado');
      const data = validateTemplate(
        { name: input?.name ?? current.name, body: input?.body ?? current.body },
        current.situation,
      );
      const template = await tx.messageTemplate.update({
        where: { id },
        data: { ...data, ...(input?.status ? { status: input.status } : {}) },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: 'UPDATE',
          entityType: 'MESSAGE_TEMPLATE',
          entityId: id,
          before: { name: current.name, body: current.body, status: current.status },
          after: { name: template.name, body: template.body, status: template.status },
        },
      });
      return template;
    });
    return mapTemplate(updated);
  }

  /** Deja anotado que se abrió WhatsApp con este texto para este alumno o potencial. */
  async registerSend(input: RegisterMessageSendDto | null, actorId: string) {
    const situation = parseSituation(input?.situation);
    const body = typeof input?.body === 'string' ? input.body.trim() : '';
    if (!body || body.length > 4000)
      throw new DomainError('VALIDATION_ERROR', 'El mensaje no puede estar vacío', {
        field: 'body',
      });
    const studentId = input?.studentId ? parseUuid(input.studentId, 'studentId') : null;
    const leadId = input?.leadId ? parseUuid(input.leadId, 'leadId') : null;
    if ((studentId === null) === (leadId === null))
      throw new DomainError('VALIDATION_ERROR', 'Indicá el alumno o el potencial alumno', {
        field: 'studentId',
      });
    const templateId = input?.templateId ? parseUuid(input.templateId, 'templateId') : null;
    const [recipient, template] = await Promise.all([
      studentId
        ? this.prisma.student.findUnique({ where: { id: studentId }, select: { id: true } })
        : this.prisma.lead.findUnique({ where: { id: leadId! }, select: { id: true } }),
      templateId
        ? this.prisma.messageTemplate.findUnique({
            where: { id: templateId },
            select: { situation: true },
          })
        : null,
    ]);
    if (!recipient)
      throw new DomainError('MESSAGE_RECIPIENT_NOT_FOUND', 'No encontramos a esa persona');
    if (templateId && template?.situation !== situation)
      throw new DomainError('MESSAGE_TEMPLATE_NOT_FOUND', 'Mensaje no encontrado');
    const send = await this.prisma.messageSend.create({
      data: { situation, templateId, studentId, leadId, body, sentByUserId: actorId },
      select: {
        createdAt: true,
        sentBy: { select: { username: true } },
        template: { select: { name: true } },
      },
    });
    return {
      sentAt: send.createdAt.toISOString(),
      sentBy: send.sentBy.username,
      templateName: send.template?.name ?? null,
    };
  }
}
