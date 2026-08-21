import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { DomainError } from '../domain/domain-error';

type HttpResponse = {
  status(code: number): HttpResponse;
  json(body: unknown): void;
};

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();
    const status = error.code.endsWith('_NOT_FOUND')
      ? 404
      : error.code === 'DNI_ALREADY_EXISTS' ||
          error.code === 'AUTH_ALREADY_CONFIGURED' ||
          error.code.endsWith('_CONFLICT') ||
          error.code.endsWith('_IN_USE') ||
          error.code === 'DANCE_TYPE_ALREADY_EXISTS' ||
          error.code === 'ENROLLMENT_ALREADY_ACTIVE' ||
          error.code === 'ENROLLMENT_ALREADY_ENDED' ||
          error.code === 'CLASS_FULL' ||
          error.code === 'CLASS_CAPACITY_BELOW_ENROLLMENT_COUNT' ||
          error.code === 'MONTHLY_CHARGE_ALREADY_EXISTS' ||
          error.code === 'USERNAME_ALREADY_EXISTS' ||
          error.code === 'CANNOT_RESTRICT_SELF' ||
          error.code === 'LAST_DIRECTION_USER_REQUIRED' ||
          error.code.endsWith('_HAS_ACTIVE_ENROLLMENTS')
        ? 409
        : error.code === 'FORBIDDEN'
          ? 403
          : error.code === 'UNAUTHORIZED' || error.code === 'INVALID_CREDENTIALS'
            ? 401
            : 400;
    response.status(status).json({
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }
}
