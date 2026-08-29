import { Controller, Get, Query } from '@nestjs/common';
import { Permissions } from '../../auth/presentation/permissions.decorator';
import { DomainError } from '../../shared/domain/domain-error';
import { parseUuid } from '../../shared/presentation/request-validation';
import { AuditService } from '../application/audit.service';

@Controller('audit-logs')
@Permissions('audit:read')
export class AuditController {
  constructor(private readonly service: AuditService) {}
  @Get()
  list(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    const page = this.positive(pageRaw, 'page', 1, Number.MAX_SAFE_INTEGER);
    const pageSize = this.positive(pageSizeRaw, 'pageSize', 25, 100);
    const fromDate = this.service.parseDate(from, 'from');
    const toDate = this.service.parseDate(to, 'to');
    return this.service.list({
      ...(entityType?.trim() ? { entityType: entityType.trim() } : {}),
      ...(action?.trim() ? { action: action.trim() } : {}),
      ...(entityId ? { entityId: parseUuid(entityId, 'entityId') } : {}),
      ...(actorUserId ? { actorUserId: parseUuid(actorUserId, 'actorUserId') } : {}),
      ...(fromDate ? { from: fromDate } : {}),
      ...(toDate ? { to: toDate } : {}),
      page,
      pageSize,
    });
  }
  private positive(value: string | undefined, field: string, fallback: number, max: number) {
    if (!value) return fallback;
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max)
      throw new DomainError('VALIDATION_ERROR', `${field} no es válido`, { field });
    return Number(value);
  }
}
