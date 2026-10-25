import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS_KEY } from '../../auth/presentation/permissions.decorator';
import { SelfCheckInController } from './self-check-in.controller';

describe('SelfCheckInController', () => {
  it('requiere el permiso de asistencias (la sesión de recepción)', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, SelfCheckInController)).toEqual([
      'attendance:manage',
    ]);
  });

  it('delega el DNI recibido al servicio', async () => {
    const service = { checkIn: vi.fn(async () => ({ outcome: 'NO_CLASS_NOW' })) };
    const controller = new SelfCheckInController(service as never);
    await controller.checkIn({ dni: '40111222' });
    expect(service.checkIn).toHaveBeenCalledWith('40111222');
  });
});
