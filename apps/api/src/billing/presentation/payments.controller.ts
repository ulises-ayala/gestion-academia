import type {
  CreatePaymentDto,
  PaymentMethodDto,
  PaymentStatusDto,
  PaymentSummaryDto,
  ReceivablesScopeDto,
  VoidPaymentDto,
} from '@academy/contracts';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { Permissions } from '../../auth/presentation/permissions.decorator';
import { DomainError } from '../../shared/domain/domain-error';
import { parsePage, parseUuid } from '../../shared/presentation/request-validation';
import { PaymentsService } from '../application/payments.service';
import { ReceivablesService } from '../application/receivables.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly service: PaymentsService,
    private readonly receivables: ReceivablesService,
  ) {}

  @Get()
  @Permissions('payments:read')
  list(
    @Query('studentId') studentId?: string,
    @Query('status') status?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (status && status !== 'CONFIRMED' && status !== 'VOID')
      throw new DomainError('VALIDATION_ERROR', 'Estado de pago inválido', { field: 'status' });
    if (
      paymentMethod &&
      paymentMethod !== 'CASH' &&
      paymentMethod !== 'MERCADO_PAGO' &&
      paymentMethod !== 'CARD'
    )
      throw new DomainError('VALIDATION_ERROR', 'Medio de pago inválido', {
        field: 'paymentMethod',
      });
    return this.service.list({
      ...(studentId ? { studentId: parseUuid(studentId, 'studentId') } : {}),
      ...(status ? { status: status as PaymentStatusDto } : {}),
      ...(paymentMethod ? { paymentMethod: paymentMethod as PaymentMethodDto } : {}),
      page: parsePage(page, 'page', 1, 1_000_000),
      pageSize: parsePage(pageSize, 'pageSize', 25, 100),
    });
  }

  @Get('summary')
  @Permissions('payments:read')
  summary(@Query('studentId') studentId: string): Promise<PaymentSummaryDto> {
    return this.service.summary(parseUuid(studentId, 'studentId'));
  }

  @Get('receivables')
  @Permissions('charges:read', 'payments:read')
  receivableList(
    @Query('scope') scope?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (scope !== 'pending' && scope !== 'overdue')
      throw new DomainError('VALIDATION_ERROR', 'La vista de deuda no es válida', {
        field: 'scope',
      });
    return this.receivables.list(
      scope as ReceivablesScopeDto,
      parsePage(page, 'page', 1, 1_000_000),
      parsePage(pageSize, 'pageSize', 20, 100),
    );
  }

  @Get(':id')
  @Permissions('payments:read')
  get(@Param('id') id: string) {
    return this.service.get(parseUuid(id));
  }

  @Post()
  @Permissions('payments:collect')
  create(@Body() input: CreatePaymentDto, @CurrentUser() user: PublicAuthUser) {
    return this.service.create(
      {
        ...input,
        monthlyChargeIds: input.monthlyChargeIds?.map((id) => parseUuid(id, 'monthlyChargeIds')),
      },
      user.id,
    );
  }

  @Post(':id/void')
  @Permissions('payments:void')
  void(@Param('id') id: string, @Body() body: VoidPaymentDto, @CurrentUser() user: PublicAuthUser) {
    return this.service.void(parseUuid(id), user.id, body?.reason);
  }
}
