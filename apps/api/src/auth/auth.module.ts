import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from '../database/database.module';
import { AUTH_REPOSITORY } from './application/auth.repository';
import { AuthService } from './application/auth.service';
import { PrismaAuthRepository } from './infrastructure/prisma-auth.repository';
import { AuthGuard } from './presentation/auth.guard';
import { AuthController } from './presentation/auth.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PrismaAuthRepository,
    { provide: AUTH_REPOSITORY, useExisting: PrismaAuthRepository },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
