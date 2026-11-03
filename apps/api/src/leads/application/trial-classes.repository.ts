import type { LeadTrialClassDto } from '@academy/contracts';

export const TRIAL_CLASSES_REPOSITORY = Symbol('TRIAL_CLASSES_REPOSITORY');

export interface TrialClassesRepository {
  list(leadId: string): Promise<LeadTrialClassDto[]>;
  /**
   * Registra la prueba y pasa al potencial alumno a "Clase de prueba" si correspondía. Rechaza
   * una segunda prueba de la misma clase (`TRIAL_CLASS_ALREADY_TAKEN`).
   */
  create(
    leadId: string,
    input: Readonly<{ classId: string; trialDate: string; notes: string | null }>,
    actorId: string,
  ): Promise<LeadTrialClassDto>;
  /** Quita una prueba cargada por error; queda en la auditoría con el motivo. */
  remove(leadId: string, id: string, reason: string, actorId: string): Promise<void>;
}
