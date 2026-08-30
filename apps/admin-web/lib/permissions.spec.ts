import { describe, expect, it } from 'vitest';
import { roleCan } from './permissions';

describe('lead UI permission', () => {
  it('permite gestionar potenciales a los tres roles', () => {
    expect(roleCan('RECEPTION', 'leads:manage')).toBe(true);
    expect(roleCan('MANAGER', 'leads:manage')).toBe(true);
    expect(roleCan('ADMINISTRATOR', 'leads:manage')).toBe(true);
  });
});
