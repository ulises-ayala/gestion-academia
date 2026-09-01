import { describe, expect, it } from 'vitest';
import { roleCan } from './permissions';

describe('lead UI permission', () => {
  it('permite gestionar potenciales a los tres roles', () => {
    expect(roleCan('RECEPTION', 'leads:manage')).toBe(true);
    expect(roleCan('MANAGER', 'leads:manage')).toBe(true);
    expect(roleCan('ADMINISTRATOR', 'leads:manage')).toBe(true);
  });

  it('permite operar la caja propia sin conceder conciliación a Admisión', () => {
    expect(roleCan('RECEPTION', 'cash:manage')).toBe(true);
    expect(roleCan('RECEPTION', 'cash:reconcile')).toBe(false);
    expect(roleCan('MANAGER', 'cash:reconcile')).toBe(true);
    expect(roleCan('ADMINISTRATOR', 'cash:reconcile')).toBe(true);
  });
});
