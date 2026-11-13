import type {
  CreateLeadDto,
  LeadDto,
  LeadDuplicateListDto,
  LeadListDto,
  LeadSourceDto,
  LeadStatusDto,
  RegisterTrialVisitDto,
  TrialVisitResultDto,
  UpdateLeadDto,
} from '@academy/contracts';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { Permissions } from '../../auth/presentation/permissions.decorator';
import { DomainError } from '../../shared/domain/domain-error';
import { parsePage, parseUuid } from '../../shared/presentation/request-validation';
import type { LeadData } from '../domain/lead';
import { leadSources, leadStatuses } from '../domain/lead';
import { LeadsService } from '../application/leads.service';
import { TrialClassesService } from '../application/trial-classes.service';

const toDto = (lead: LeadData): LeadDto => ({
  id: lead.id,
  name: lead.name,
  phone: lead.phone,
  email: lead.email,
  instagram: lead.instagram,
  source: lead.source,
  status: lead.status,
  notes: lead.notes,
  nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
  lastContactAt: lead.lastContactAt?.toISOString() ?? null,
  studentId: lead.studentId,
  createdAt: lead.createdAt.toISOString(),
  updatedAt: lead.updatedAt.toISOString(),
});

@Controller('leads')
@Permissions('leads:manage')
export class LeadsController {
  constructor(
    private readonly service: LeadsService,
    private readonly trials: TrialClassesService,
  ) {}

  @Get()
  async list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('followUp') followUp?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<LeadListDto> {
    if (q && q.trim().length > 100)
      throw new DomainError('VALIDATION_ERROR', 'La búsqueda no puede superar 100 caracteres', {
        field: 'q',
      });
    // OPEN: los que siguen abiertos (Consulta, Interesado/a y Clase de prueba).
    if (status && status !== 'OPEN' && !leadStatuses.includes(status as LeadStatusDto))
      throw new DomainError('VALIDATION_ERROR', 'El estado no es válido', { field: 'status' });
    if (source && !leadSources.includes(source as LeadSourceDto))
      throw new DomainError('VALIDATION_ERROR', 'El origen no es válido', { field: 'source' });
    if (followUp && followUp !== 'PENDING' && followUp !== 'OVERDUE')
      throw new DomainError('VALIDATION_ERROR', 'El filtro de seguimiento no es válido', {
        field: 'followUp',
      });
    const result = await this.service.list({
      ...(q?.trim() ? { q: q.trim() } : {}),
      ...(status ? { status: status as LeadStatusDto | 'OPEN' } : {}),
      ...(source ? { source: source as LeadSourceDto } : {}),
      ...(followUp ? { followUp: followUp as 'PENDING' | 'OVERDUE' } : {}),
      now: new Date(),
      page: parsePage(page, 'page', 1, Number.MAX_SAFE_INTEGER),
      pageSize: parsePage(pageSize, 'pageSize', 25, 100),
    });
    return { ...result, items: result.items.map(toDto) };
  }

  @Get('duplicates')
  async duplicates(
    @Query('phone') phone?: string,
    @Query('email') email?: string,
    @Query('instagram') instagram?: string,
    @Query('excludeId') excludeId?: string,
  ): Promise<LeadDuplicateListDto> {
    const items = await this.service.duplicates({
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
      ...(instagram ? { instagram } : {}),
      ...(excludeId ? { excludeId: parseUuid(excludeId, 'excludeId') } : {}),
    });
    return { items: items.map((item) => ({ lead: toDto(item.lead), matches: item.matches })) };
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<LeadDto> {
    return toDto(await this.service.get(parseUuid(id)));
  }

  /** Clase de prueba cargada desde Nuevo alumno: crea el potencial o le suma la prueba. */
  @Post('trial-visits')
  async registerTrialVisit(
    @Body() input: RegisterTrialVisitDto | null,
    @CurrentUser() user: PublicAuthUser,
  ): Promise<TrialVisitResultDto> {
    const result = await this.trials.registerVisit(
      input && typeof input.classId === 'string'
        ? { ...input, classId: parseUuid(input.classId, 'classId') }
        : input,
      user.id,
    );
    return { ...result, lead: toDto(result.lead) };
  }

  @Post()
  async create(@Body() input: CreateLeadDto): Promise<LeadDto> {
    return toDto(await this.service.create(input));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() input: UpdateLeadDto,
    @CurrentUser() user: PublicAuthUser,
  ): Promise<LeadDto> {
    return toDto(await this.service.update(parseUuid(id), input, user.id));
  }
}
