import { PERMISSIONS_KEY } from '../../auth/presentation/permissions.decorator';
import { describe, expect, it } from 'vitest';
import { ReportsController } from './reports.controller';

describe('ReportsController', () => {
  it('protege todo el módulo con reports:operational', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, ReportsController)).toEqual([
      'reports:operational',
    ]);
  });

  it('rechaza fechas inexistentes antes de consultar datos', () => {
    const controller = new ReportsController({} as never);
    expect(() => controller.operational('2026-02-30', '2026-03-01')).toThrowError(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });
});
