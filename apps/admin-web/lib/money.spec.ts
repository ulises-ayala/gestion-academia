import { describe, expect, it } from 'vitest';
import { compactMoney } from './money';

describe('importes', () => {
  it('abrevia millones y miles', () => {
    expect(compactMoney(2_400_000)).toContain('2,4 M');
    expect(compactMoney(640_000)).toBe('$640 mil');
    expect(compactMoney(900)).toMatch(/\$\s?900/);
  });
});
