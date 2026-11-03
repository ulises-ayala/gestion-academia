import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LEAD_REPOSITORY } from './application/lead.repository';
import { LeadsService } from './application/leads.service';
import { TRIAL_CLASSES_REPOSITORY } from './application/trial-classes.repository';
import { TrialClassesService } from './application/trial-classes.service';
import { PrismaLeadRepository } from './infrastructure/prisma-lead.repository';
import { PrismaTrialClassesRepository } from './infrastructure/prisma-trial-classes.repository';
import { LeadTrialClassesController } from './presentation/lead-trial-classes.controller';
import { LeadsController } from './presentation/leads.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [LeadsController, LeadTrialClassesController],
  providers: [
    LeadsService,
    PrismaLeadRepository,
    { provide: LEAD_REPOSITORY, useExisting: PrismaLeadRepository },
    TrialClassesService,
    PrismaTrialClassesRepository,
    { provide: TRIAL_CLASSES_REPOSITORY, useExisting: PrismaTrialClassesRepository },
  ],
})
export class LeadsModule {}
