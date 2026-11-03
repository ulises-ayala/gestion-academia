import type {
  ApplyCreditDto,
  ApplyCreditResultDto,
  CorrectPaymentDto,
  CreateOtherPaymentDto,
  CreatePaymentDto,
  PaymentMethodDto,
  PaymentStatusDto,
  PaymentSummaryDto,
  ReallocatePaymentDto,
  RefundPaymentDto,
  ReceivablesScopeDto,
  ReceivablesSortDto,
  VoidPaymentDto,
} from '@academy/contracts';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { hasPermissions } from '../../auth/domain/permissions';
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
      paymentMethod !== 'TRANSFER' &&
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
      {
        ...input,
        studentId: parseUuid(input.studentId, 'studentId'),
        ...(Array.isArray(input.monthlyChargeIds)
          ? {
              monthlyChargeIds: input.monthlyChargeIds.map((id) =>
                parseUuid(id, 'monthlyChargeIds'),
              ),
            }
          : {}),
      },
      user.id,
      hasPermissions(user, ['payments:void']),
    );
  }

  @Post('other')
  @Permissions('payments:collect')
  createOther(@Body() input: CreateOtherPaymentDto | null, @CurrentUser() user: PublicAuthUser) {
    if (!input || typeof input !== 'object')
      throw new DomainError('VALIDATION_ERROR', 'El cuerpo del cobro es obligatorio');
    return this.service.createOther(
      {
        ...input,
        studentId: input.studentId ? parseUuid(input.studentId, 'studentId') : null,
        classId: input.classId ? parseUuid(input.classId, 'classId') : null,
        teacherId: input.teacherId ? parseUuid(input.teacherId, 'teacherId') : null,
      },
      user.id,
      hasPermissions(user, ['payments:void']),
    );
  }

  @Post(':id/void')
  @Permissions('payments:void')
  void(@Param('id') id: string, @Body() body: VoidPaymentDto, @CurrentUser() user: PublicAuthUser) {
    return this.service.void(parseUuid(id), user.id, body?.reason);
  }

  /** Usar el saldo a favor del alumno en sus cuotas pendientes: mismos permisos que reimputar. */
  @Post('apply-credit')
  @Permissions('payments:void')
  applyCredit(
    @Body() body: ApplyCreditDto | null,
    @CurrentUser() user: PublicAuthUser,
  ): Promise<ApplyCreditResultDto> {
    return this.service.applyCredit(
      { ...body, studentId: parseUuid(body?.studentId ?? '', 'studentId') },
      user.id,
    );
  }

  /** Devolver saldo a favor: mismos permisos que anular o corregir. */
  @Post(':id/refunds')
  @Permissions('payments:void')
  refund(
    @Param('id') id: string,
    @Body() body: RefundPaymentDto | null,
    @CurrentUser() user: PublicAuthUser,
  ) {
    return this.service.refund(parseUuid(id), body, user.id);
  }

  @Post(':id/correct')
  @Permissions('payments:void')
  correct(
    @Param('id') id: string,
    @Body() body: CorrectPaymentDto | null,
    @CurrentUser() user: PublicAuthUser,
  ) {
    return this.service.correct(parseUuid(id), body, user.id);
  }

  /** Reimputar: cambiar a qué cuotas se aplicó el pago (los mismos que corrigen). */
  @Post(':id/allocations')
  @Permissions('payments:void')
  reallocate(
    @Param('id') id: string,
    @Body() body: ReallocatePaymentDto | null,
    @CurrentUser() user: PublicAuthUser,
  ) {
    const allocations = Array.isArray(body?.allocations)
      ? body.allocations.map((row, index) => ({
          ...row,
          monthlyChargeId: parseUuid(row?.monthlyChargeId, `allocations.${index}.monthlyChargeId`),
        }))
      : body?.allocations;
    return this.service.reallocate(
      parseUuid(id),
      body && typeof body === 'object' ? ({ ...body, allocations } as ReallocatePaymentDto) : null,
      user.id,
    );
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
