import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PublicAuthUser } from '../application/auth.repository';
import { hasPermissions, type Permission } from '../domain/permissions';
import { DomainError } from '../../shared/domain/domain-error';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<{ adminUser?: PublicAuthUser }>();
    if (!request.adminUser || !hasPermissions(request.adminUser, required))
      throw new DomainError('FORBIDDEN', 'No tenés permisos para realizar esta acción');
    return true;
  }
}
