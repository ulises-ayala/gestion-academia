import { PERMISSIONS_KEY } from '../../auth/presentation/permissions.decorator';
import { describe, expect, it, vi } from 'vitest';
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

  it('descarga el PDF con el período en el nombre del archivo', async () => {
    const pdf = Buffer.from('%PDF-1.3');
    const service = { pdf: vi.fn().mockResolvedValue(pdf) };
    const controller = new ReportsController(service as never);
    const file = await controller.pdf('2026-10-01', '2026-10-18', undefined, 'oldest');
    expect(service.pdf).toHaveBeenCalledWith(
      expect.objectContaining({ fromDate: '2026-10-01', toDate: '2026-10-18', debtSort: 'oldest' }),
    );
    expect(file.getHeaders()).toMatchObject({
      type: 'application/pdf',
      disposition: 'attachment; filename="reporte-carmesi-2026-10-01_2026-10-18.pdf"',
    });
  });

  it('rechaza un rango invertido también en el PDF', async () => {
    const controller = new ReportsController({} as never);
    await expect(controller.pdf('2026-10-18', '2026-10-01')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });
});
