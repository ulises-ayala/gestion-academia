import type { CreateLeadTrialClassDto } from '@academy/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { validateReason } from '../../audit/domain/audit';
import { businessDayAt } from '../../dashboard/application/business-day';
import { validateTrialClass } from '../domain/trial-class';
import { TRIAL_CLASSES_REPOSITORY, type TrialClassesRepository } from './trial-classes.repository';

const timeZone = () => process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires';

@Injectable()
export class TrialClassesService {
  constructor(
    @Inject(TRIAL_CLASSES_REPOSITORY) private readonly repository: TrialClassesRepository,
  ) {}

  list(leadId: string) {
    return this.repository.list(leadId);
  }

  async create(
    leadId: string,
    input: CreateLeadTrialClassDto | null,
    actorId: string,
    now = new Date(),
  ) {
    const today = businessDayAt(now, timeZone()).date;
    return this.repository.create(leadId, validateTrialClass(input ?? {}, today), actorId);
  }

  async remove(leadId: string, id: string, reason: unknown, actorId: string) {
    return this.repository.remove(leadId, id, validateReason(reason), actorId);
  }
}
