import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/presentation/public.decorator';

export interface HealthResponse {
  status: 'ok';
  service: 'academy-api';
}

@Controller('health')
@Public()
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: 'ok', service: 'academy-api' };
  }
}
