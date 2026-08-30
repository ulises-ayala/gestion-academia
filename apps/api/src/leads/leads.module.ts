import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LEAD_REPOSITORY } from './application/lead.repository';
import { LeadsService } from './application/leads.service';
import { PrismaLeadRepository } from './infrastructure/prisma-lead.repository';
import { LeadsController } from './presentation/leads.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [LeadsController],
  providers: [
    LeadsService,
    PrismaLeadRepository,
    { provide: LEAD_REPOSITORY, useExisting: PrismaLeadRepository },
  ],
})
export class LeadsModule {}
