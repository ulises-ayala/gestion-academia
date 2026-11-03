import type { SavePaymentConceptDto } from '@academy/contracts';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { Permissions } from '../../auth/presentation/permissions.decorator';
import { DomainError } from '../../shared/domain/domain-error';
import { parseUuid } from '../../shared/presentation/request-validation';
import { PaymentConceptsService } from '../application/payment-concepts.service';

/** Conceptos de ingreso: los lista quien cobra; los amplían Administración y Dirección. */
@Controller('payment-concepts')
export class PaymentConceptsController {
  constructor(private readonly service: PaymentConceptsService) {}

  @Get() @Permissions('payments:collect') list(@Query('status') status?: string) {
    const value = status ?? 'ACTIVE';
    if (value !== 'ACTIVE' && value !== 'INACTIVE' && value !== 'ALL')
      throw new DomainError('VALIDATION_ERROR', 'Estado inválido', { field: 'status' });
    return this.service.list(value);
  }

  @Post() @Permissions('charges:manage') create(
    @Body() body: SavePaymentConceptDto | null,
    @CurrentUser() user: PublicAuthUser,
  ) {
    return this.service.create(body, user.id);
  }

  @Patch(':id') @Permissions('charges:manage') update(
    @Param('id') id: string,
    @Body() body: SavePaymentConceptDto | null,
    @CurrentUser() user: PublicAuthUser,
  ) {
    return this.service.update(parseUuid(id), body, user.id);
  }
}
