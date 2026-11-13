import { PrismaService } from '../../database/prisma.service';
import { DomainError } from '../../shared/domain/domain-error';
import { assertLeadConvertible } from '../domain/lead';

/**
 * Deja al potencial alumno inscripto y vinculado al alumno que se creó desde su ficha. Corre
 * dentro de la transacción del alta del alumno: si algo falla, no queda ni el alumno ni el vínculo.
 */
export class PrismaLeadConversion {
  constructor(private readonly prisma: PrismaService) {}

  async markEnrolled(leadId: string, studentId: string, actorId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, status: true, studentId: true },
    });
    if (!lead) throw new DomainError('LEAD_NOT_FOUND', 'Potencial alumno no encontrado');
    assertLeadConvertible(lead);
    await this.prisma.lead.update({
      where: { id: leadId },
      data: { status: 'ENROLLED', studentId },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actorId,
        action: 'UPDATE',
        entityType: 'LEAD',
        entityId: leadId,
        before: { status: lead.status, studentId: null },
        after: { status: 'ENROLLED', studentId },
        metadata: { source: 'LEAD_CONVERSION' },
      },
    });
  }
}
