import type { PaymentConceptDto, SavePaymentConceptDto } from '@academy/contracts';
import { Prisma } from '@academy/database';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DomainError } from '../../shared/domain/domain-error';
import { validatePaymentConcept } from '../domain/other-payment';

type Row = Prisma.PaymentConceptGetPayload<object>;
const mapConcept = (item: Row): PaymentConceptDto => ({
  id: item.id,
  name: item.name,
  requiresDetail: item.requiresDetail,
  status: item.status,
  sortOrder: item.sortOrder,
});

/**
 * Catálogo de conceptos de ingreso de los otros cobros (indumentaria, inscripciones, talleres…).
 * Administración y Dirección lo amplían; un concepto se desactiva, no se borra (tiene cobros).
 */
@Injectable()
export class PaymentConceptsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(status: 'ACTIVE' | 'INACTIVE' | 'ALL' = 'ACTIVE') {
    const items = await this.prisma.paymentConcept.findMany({
      where: status === 'ALL' ? {} : { status },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return items.map(mapConcept);
  }

  async create(input: SavePaymentConceptDto | null, actorId: string) {
    const data = validatePaymentConcept(input ?? {});
    return this.save(actorId, async (tx) => {
      const created = await tx.paymentConcept.create({
        data: {
          name: data.name,
          normalizedName: data.normalizedName,
          requiresDetail: data.requiresDetail,
          status: data.status ?? 'ACTIVE',
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: 'CREATE',
          entityType: 'PAYMENT_CONCEPT',
          entityId: created.id,
          after: { name: created.name, requiresDetail: created.requiresDetail },
        },
      });
      return created;
    });
  }

  async update(id: string, input: SavePaymentConceptDto | null, actorId: string) {
    const data = validatePaymentConcept(input ?? {});
    return this.save(actorId, async (tx) => {
      const current = await tx.paymentConcept.findUnique({ where: { id } });
      if (!current)
        throw new DomainError('PAYMENT_CONCEPT_NOT_FOUND', 'Concepto de cobro no encontrado');
      const updated = await tx.paymentConcept.update({
        where: { id },
        data: {
          name: data.name,
          normalizedName: data.normalizedName,
          requiresDetail: data.requiresDetail,
          ...(data.status ? { status: data.status } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: 'UPDATE',
          entityType: 'PAYMENT_CONCEPT',
          entityId: id,
          before: {
            name: current.name,
            requiresDetail: current.requiresDetail,
            status: current.status,
          },
          after: {
            name: updated.name,
            requiresDetail: updated.requiresDetail,
            status: updated.status,
          },
        },
      });
      return updated;
    });
  }

  private async save(
    _actorId: string,
    run: (tx: Prisma.TransactionClient) => Promise<Row>,
  ): Promise<PaymentConceptDto> {
    try {
      return mapConcept(await this.prisma.$transaction(run));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new DomainError(
          'PAYMENT_CONCEPT_NAME_CONFLICT',
          'Ya hay un concepto con ese nombre',
          { field: 'name' },
        );
      throw error;
    }
  }
}
