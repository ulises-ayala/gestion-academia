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
    const status = error.code === 'STUDENT_NOT_FOUND' ? 404
      : error.code === 'DNI_ALREADY_EXISTS' || error.code === 'AUTH_ALREADY_CONFIGURED' ? 409
      : error.code === 'UNAUTHORIZED' || error.code === 'INVALID_CREDENTIALS' ? 401
      : 400;
    response.status(status).json({
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }
}
