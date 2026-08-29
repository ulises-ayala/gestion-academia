import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditService } from './application/audit.service';
import { AuditController } from './presentation/audit.controller';
@Module({
  imports: [DatabaseModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
