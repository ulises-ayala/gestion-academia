import { describe, expect, it } from 'vitest';
import { userInitial } from './user-menu';

describe('User menu', () => {
  it('shows a single uppercase initial for the account', () => {
    expect(userInitial('sofia')).toBe('S');
    expect(userInitial('  marta')).toBe('M');
  });

  it('falls back when the username is empty', () => {
    expect(userInitial('')).toBe('?');
  });
});
