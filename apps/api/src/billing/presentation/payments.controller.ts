import type {
  CreatePaymentDto,
  PaymentMethodDto,
  PaymentStatusDto,
  PaymentSummaryDto,
  ReceivablesScopeDto,
  ReceivablesSortDto,
  VoidPaymentDto,
} from '@academy/contracts';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { Permissions } from '../../auth/presentation/permissions.decorator';
import { businessDayAt } from '../../dashboard/application/business-day';
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
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
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
    const search = this.search(q);
    return this.service.list({
      ...(studentId ? { studentId: parseUuid(studentId, 'studentId') } : {}),
      ...(status ? { status: status as PaymentStatusDto } : {}),
      ...(paymentMethod ? { paymentMethod: paymentMethod as PaymentMethodDto } : {}),
      ...(search ? { q: search } : {}),
      ...(from ? { from: this.dateBoundary(from, 'from', 'start') } : {}),
      ...(to ? { toExclusive: this.dateBoundary(to, 'to', 'end') } : {}),
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
    @Query('q') q?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const selectedScope = scope || 'pending';
    const selectedSort = sort || 'oldest';
    const search = this.search(q);
    if (!['pending', 'overdue', 'partial', 'unpaid'].includes(selectedScope))
      throw new DomainError('VALIDATION_ERROR', 'La vista de deuda no es válida', {
        field: 'scope',
      });
    if (!['oldest', 'highest-debt', 'name'].includes(selectedSort))
      throw new DomainError('VALIDATION_ERROR', 'El orden de deuda no es válido', {
        field: 'sort',
      });
    return this.receivables.list({
      scope: selectedScope as ReceivablesScopeDto,
      sort: selectedSort as ReceivablesSortDto,
      ...(search ? { q: search } : {}),
      page: parsePage(page, 'page', 1, 1_000_000),
      pageSize: parsePage(pageSize, 'pageSize', 25, 100),
    });
  }

  @Get(':id')
  @Permissions('payments:read')
  get(@Param('id') id: string) {
    return this.service.get(parseUuid(id));
  }

  @Post()
  @Permissions('payments:collect')
  create(@Body() input: CreatePaymentDto | null, @CurrentUser() user: PublicAuthUser) {
    if (!input || typeof input !== 'object')
      throw new DomainError('VALIDATION_ERROR', 'El cuerpo del pago es obligatorio');
    return this.service.create(
      { ...input, studentId: parseUuid(input.studentId, 'studentId') },
      user.id,
    );
  }

  @Post(':id/void')
  @Permissions('payments:void')
  void(@Param('id') id: string, @Body() body: VoidPaymentDto, @CurrentUser() user: PublicAuthUser) {
    return this.service.void(parseUuid(id), user.id, body?.reason);
  }

  private search(value?: string) {
    const q = value?.trim();
    if (q && q.length > 100)
      throw new DomainError('VALIDATION_ERROR', 'La búsqueda es demasiado larga', { field: 'q' });
    return q || undefined;
  }

  private dateBoundary(value: string, field: 'from' | 'to', boundary: 'start' | 'end') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new DomainError('VALIDATION_ERROR', 'La fecha no es válida', { field });
    const day = businessDayAt(
      new Date(`${value}T12:00:00.000Z`),
      process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires',
    );
    if (day.date !== value)
      throw new DomainError('VALIDATION_ERROR', 'La fecha no es válida', { field });
    return boundary === 'start' ? day.start : day.end;
  }
}
