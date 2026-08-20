import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './shared/presentation/domain-exception.filter';
import { adminOrigins } from './shared/infrastructure/runtime-config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: adminOrigins(),
    credentials: true,
  });
  app.useGlobalFilters(new DomainExceptionFilter());
  app.enableShutdownHooks();

  const port = Number.parseInt(process.env.PORT ?? process.env.API_PORT ?? '3001', 10);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
