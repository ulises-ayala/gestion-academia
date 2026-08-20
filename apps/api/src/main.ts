import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './shared/presentation/domain-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: process***REMOVED***.ADMIN_WEB_URL ?? 'http://localhost:3000', credentials: true });
  app.useGlobalFilters(new DomainExceptionFilter());
  app.enableShutdownHooks();

  const port = Number.parseInt(process***REMOVED***.API_PORT ?? '3001', 10);
  await app.listen(port);
}

void bootstrap();
