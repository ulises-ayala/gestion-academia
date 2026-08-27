import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { PublicAuthUser } from '../application/auth.repository';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PublicAuthUser =>
    context.switchToHttp().getRequest<{ adminUser: PublicAuthUser }>().adminUser,
);
