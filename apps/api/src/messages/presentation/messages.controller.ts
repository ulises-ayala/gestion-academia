import type { RegisterMessageSendDto, SaveMessageTemplateDto } from '@academy/contracts';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { Permissions } from '../../auth/presentation/permissions.decorator';
import { parseUuid } from '../../shared/presentation/request-validation';
import { MessagesService } from '../application/messages.service';

/**
 * Mensajes de WhatsApp por situación. Los ve y los envía quien gestiona alumnos (también
 * Admisión); los mensajes predeterminados los editan Administración y Dirección.
 */
@Controller('messages')
export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  @Get('situations') @Permissions('students:manage') situations() {
    return this.service.situations();
  }

  @Get('recipients') @Permissions('students:manage') recipients(
    @Query('situation') situation?: string,
  ) {
    return this.service.recipients(situation);
  }

  @Post('sends') @Permissions('students:manage') registerSend(
    @Body() body: RegisterMessageSendDto | null,
    @CurrentUser() user: PublicAuthUser,
  ) {
    return this.service.registerSend(body, user.id);
  }

  @Post('templates') @Permissions('messages:manage') createTemplate(
    @Body() body: SaveMessageTemplateDto | null,
    @CurrentUser() user: PublicAuthUser,
  ) {
    return this.service.createTemplate(body, user.id);
  }

  @Patch('templates/:id') @Permissions('messages:manage') updateTemplate(
    @Param('id') id: string,
    @Body() body: SaveMessageTemplateDto | null,
    @CurrentUser() user: PublicAuthUser,
  ) {
    return this.service.updateTemplate(parseUuid(id), body, user.id);
  }
}
