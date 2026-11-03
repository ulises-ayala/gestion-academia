import type { ClosingKindDto, CreateClosingDto } from '@academy/contracts';
import { Body, Controller, Get, Param, Post, Query, StreamableFile } from '@nestjs/common';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { Permissions } from '../../auth/presentation/permissions.decorator';
import { DomainError } from '../../shared/domain/domain-error';
import { parsePage, parseUuid } from '../../shared/presentation/request-validation';
import { ClosingsService } from '../application/closings.service';

const kindOf = (value?: string): ClosingKindDto => {
  if (value === 'WEEKLY' || value === 'MONTHLY') return value;
  throw new DomainError('VALIDATION_ERROR', 'Elegí si el cierre es semanal o mensual', {
    field: 'kind',
  });
};

/** Cierres semanales y mensuales: los hace Administración y los consulta Dirección. */
@Controller('closings')
export class ClosingsController {
  constructor(private readonly service: ClosingsService) {}

  @Get() @Permissions('cash:reconcile') list(
    @Query('kind') kind?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list(
      kindOf(kind),
      parsePage(page, 'page', 1, 1_000_000),
      parsePage(pageSize, 'pageSize', 20, 100),
    );
  }

  /** Próximo período a cerrar con sus importes, para revisarlo antes de guardar. */
  @Get('preview') @Permissions('cash:reconcile') preview(
    @Query('kind') kind?: string,
    @Query('from') fromDate?: string,
    @Query('to') toDate?: string,
    @Query('month') month?: string,
  ) {
    return this.service.preview(kindOf(kind), {
      fromDate: fromDate ?? null,
      toDate: toDate ?? null,
      month: month ?? null,
    });
  }

  @Get(':id') @Permissions('cash:reconcile') get(@Param('id') id: string) {
    return this.service.get(parseUuid(id));
  }

  @Get(':id/pdf') @Permissions('cash:reconcile') async pdf(@Param('id') id: string) {
    const { file, fileName } = await this.service.pdf(parseUuid(id));
    return new StreamableFile(file, {
      type: 'application/pdf',
      disposition: `inline; filename="${fileName}"`,
      length: file.length,
    });
  }

  @Post() @Permissions('cash:reconcile') create(
    @Body() body: CreateClosingDto | null,
    @CurrentUser() user: PublicAuthUser,
  ) {
    return this.service.create(body, user.id);
  }
}
