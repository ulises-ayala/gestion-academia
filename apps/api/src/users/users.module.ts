import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { USER_REPOSITORY } from './application/user.repository';
import { UsersService } from './application/users.service';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { UsersController } from './presentation/users.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [UsersService, { provide: USER_REPOSITORY, useClass: PrismaUserRepository }],
})
export class UsersModule {}
