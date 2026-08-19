import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports that the API is available', () => {
    expect(new HealthController().check()).toEqual({
      status: 'ok',
      service: 'academy-api',
    });
  });
});
