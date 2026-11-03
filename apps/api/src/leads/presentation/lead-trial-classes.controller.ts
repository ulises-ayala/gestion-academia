import type {
  CreateLeadTrialClassDto,
  LeadTrialClassDto,
  RemoveLeadTrialClassDto,
} from '@academy/contracts';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { Permissions } from '../../auth/presentation/permissions.decorator';
import { parseUuid } from '../../shared/presentation/request-validation';
import { TrialClassesService } from '../application/trial-classes.service';

/** Clases de prueba gratis del potencial alumno: una por clase, sin deuda ni inscripción. */
@Controller('leads/:leadId/trial-classes')
@Permissions('leads:manage')
export class LeadTrialClassesController {
  constructor(private readonly service: TrialClassesService) {}

  @Get()
  list(@Param('leadId') leadId: string): Promise<LeadTrialClassDto[]> {
    return this.service.list(parseUuid(leadId, 'leadId'));
  }

  @Post()
  create(
    @Param('leadId') leadId: string,
    @Body() input: CreateLeadTrialClassDto | null,
    @CurrentUser() user: PublicAuthUser,
  ): Promise<LeadTrialClassDto> {
    return this.service.create(
      parseUuid(leadId, 'leadId'),
      input && typeof input === 'object'
        ? {
            ...input,
            classId: input.classId ? parseUuid(input.classId, 'classId') : input.classId,
          }
        : null,
      user.id,
    );
  }

  @Post(':id/remove')
  remove(
    @Param('leadId') leadId: string,
    @Param('id') id: string,
    @Body() input: RemoveLeadTrialClassDto | null,
    @CurrentUser() user: PublicAuthUser,
  ): Promise<void> {
    return this.service.remove(parseUuid(leadId, 'leadId'), parseUuid(id), input?.reason, user.id);
  }
}
