import { describe, expect, it, vi } from 'vitest';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { PERMISSIONS_KEY } from '../../auth/presentation/permissions.decorator';
import type { TrialClassesService } from '../application/trial-classes.service';
import { LeadTrialClassesController } from './lead-trial-classes.controller';

describe('LeadTrialClassesController', () => {
  it('queda detrás de leads:manage, como el resto de los potenciales alumnos', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, LeadTrialClassesController)).toEqual([
      'leads:manage',
    ]);
  });

  it('valida los identificadores antes de llegar al caso de uso', async () => {
    const create = vi.fn();
    const controller = new LeadTrialClassesController({ create } as unknown as TrialClassesService);
    const user = { id: 'user-id' } as PublicAuthUser;
    expect(() =>
      controller.create(crypto.randomUUID(), { classId: 'no-es-un-uuid' }, user),
    ).toThrow(expect.objectContaining({ details: { field: 'classId' } }));
    expect(() => controller.create('x', { classId: crypto.randomUUID() }, user)).toThrow(
      expect.objectContaining({ details: { field: 'leadId' } }),
    );
    expect(create).not.toHaveBeenCalled();
  });
});
