import type { LeadTrialClassDto } from '@academy/contracts';
import { Prisma } from '@academy/database';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DomainError } from '../../shared/domain/domain-error';
import type { TrialClassesRepository, TrialInput } from '../application/trial-classes.repository';
import type { ValidatedLeadInput } from '../domain/lead';
import { sameFirstName, statusAfterTrial, statusAfterVisit } from '../domain/trial-class';
import { formatDate } from '../../shared/domain/format';

const include = {
  academicClass: { select: { id: true, name: true } },
  createdBy: { select: { id: true, username: true } },
};
type IncludedTrial = Prisma.LeadTrialClassGetPayload<{ include: typeof include }>;
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const toDto = (item: IncludedTrial): LeadTrialClassDto => ({
  id: item.id,
  academicClass: item.academicClass,
  trialDate: isoDate(item.trialDate),
  notes: item.notes,
  createdBy: item.createdBy,
  createdAt: item.createdAt.toISOString(),
});
const alreadyTaken = (className: string, trialDate: string) =>
  new DomainError(
    'TRIAL_CLASS_CONFLICT',
    `Ya tomó la clase de prueba de ${className} el ${formatDate(trialDate)}: es una sola vez por clase. Para volver, tiene que inscribirse y pagar.`,
    { field: 'classId' },
  );

@Injectable()
export class PrismaTrialClassesRepository implements TrialClassesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(leadId: string) {
    const items = await this.prisma.leadTrialClass.findMany({
      where: { leadId },
      include,
      orderBy: [{ trialDate: 'desc' }, { createdAt: 'desc' }],
    });
    return items.map(toDto);
  }

  async create(leadId: string, input: TrialInput, actorId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Dos cargas a la vez de la misma prueba: la segunda espera y ve la primera.
        await tx.$queryRaw`SELECT id FROM leads WHERE id = ${leadId}::uuid FOR UPDATE`;
        const lead = await tx.lead.findUnique({ where: { id: leadId } });
        if (!lead) throw new DomainError('LEAD_NOT_FOUND', 'Potencial alumno no encontrado');
        return this.addTrial(tx, lead, input, actorId, statusAfterTrial(lead.status));
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const previous = await this.prisma.leadTrialClass.findUnique({
          where: { leadId_classId: { leadId, classId: input.classId } },
          include,
        });
        if (previous) throw alreadyTaken(previous.academicClass.name, isoDate(previous.trialDate));
      }
      throw error;
    }
  }

  async registerVisit(person: ValidatedLeadInput, input: TrialInput, actorId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // La misma persona: mismo teléfono y mismo nombre de pila. La más reciente si hubiera dos.
        const candidates = person.normalizedPhone
          ? await tx.lead.findMany({
              where: { normalizedPhone: person.normalizedPhone },
              orderBy: { updatedAt: 'desc' },
            })
          : [];
        const match = candidates.find((lead) => sameFirstName(lead.name, person.name));
        if (match) await tx.$queryRaw`SELECT id FROM leads WHERE id = ${match.id}::uuid FOR UPDATE`;
        const lead = match ?? (await tx.lead.create({ data: { ...person, status: 'TRIAL' } }));
        const trialClass = await this.addTrial(tx, lead, input, actorId, statusAfterVisit(lead));
        const updated = await tx.lead.findUniqueOrThrow({ where: { id: lead.id } });
        return { lead: updated, trialClass, existingLead: Boolean(match) };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new DomainError(
          'TRIAL_CLASS_CONFLICT',
          'Ya tomó la clase de prueba de esa clase: es una sola vez por clase. Para volver, tiene que inscribirse y pagar.',
          { field: 'classId' },
        );
      throw error;
    }
  }

  /** Registra la prueba de un potencial ya bloqueado en la transacción y deja su nueva etapa. */
  private async addTrial(
    tx: Prisma.TransactionClient,
    lead: Readonly<{ id: string; status: Prisma.LeadGetPayload<object>['status'] }>,
    input: TrialInput,
    actorId: string,
    status: Prisma.LeadGetPayload<object>['status'],
  ) {
    const leadId = lead.id;
    const academicClass = await tx.academyClass.findUnique({
      where: { id: input.classId },
      select: { name: true, status: true },
    });
    if (!academicClass) throw new DomainError('CLASS_NOT_FOUND', 'Clase no encontrada');
    if (academicClass.status !== 'ACTIVE')
      throw new DomainError('CLASS_INACTIVE', 'La clase elegida está desactivada', {
        field: 'classId',
      });
    const previous = await tx.leadTrialClass.findUnique({
      where: { leadId_classId: { leadId, classId: input.classId } },
    });
    if (previous) throw alreadyTaken(academicClass.name, isoDate(previous.trialDate));
    const trial = await tx.leadTrialClass.create({
      data: {
        leadId,
        classId: input.classId,
        trialDate: new Date(`${input.trialDate}T00:00:00.000Z`),
        notes: input.notes,
        createdByUserId: actorId,
      },
      include,
    });
    if (status !== lead.status) await tx.lead.update({ where: { id: leadId }, data: { status } });
    await tx.auditLog.create({
      data: {
        actorUserId: actorId,
        action: 'CREATE',
        entityType: 'LEAD_TRIAL_CLASS',
        entityId: trial.id,
        after: { classId: input.classId, trialDate: input.trialDate, notes: input.notes },
        metadata: { leadId, leadStatusBefore: lead.status, leadStatusAfter: status },
      },
    });
    return toDto(trial);
  }

  async remove(leadId: string, id: string, reason: string, actorId: string) {
    await this.prisma.$transaction(async (tx) => {
      const trial = await tx.leadTrialClass.findFirst({ where: { id, leadId } });
      if (!trial) throw new DomainError('TRIAL_CLASS_NOT_FOUND', 'Clase de prueba no encontrada');
      await tx.leadTrialClass.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: 'DELETE',
          entityType: 'LEAD_TRIAL_CLASS',
          entityId: id,
          reason,
          before: {
            classId: trial.classId,
            trialDate: isoDate(trial.trialDate),
            notes: trial.notes,
            createdByUserId: trial.createdByUserId,
          },
          metadata: { leadId },
        },
      });
    });
  }
}
