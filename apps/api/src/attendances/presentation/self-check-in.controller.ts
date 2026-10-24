import type { SelfCheckInDto, SelfCheckInRequestDto } from '@academy/contracts';
import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { Permissions } from '../../auth/presentation/permissions.decorator';
import { SelfCheckInService } from '../application/self-check-in.service';

/** Autoregistro de asistencia desde el teclado numérico de recepción (#DNI). */
@Controller('attendances/self-check-in')
@Permissions('attendance:manage')
export class SelfCheckInController {
  constructor(@Inject(SelfCheckInService) private readonly service: SelfCheckInService) {}

  @Post()
  @HttpCode(200)
  checkIn(@Body() input: SelfCheckInRequestDto): Promise<SelfCheckInDto> {
    return this.service.checkIn(input?.dni);
  }
}
