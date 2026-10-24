import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SelfCheckInCandidate } from '../domain/self-check-in';
import type { SelfCheckInRepository, SelfCheckInStudent } from './self-check-in.repository';
import { SelfCheckInService } from './self-check-in.service';

// Viernes 16/10/2026 18:10 en Argentina (UTC-3).
const now = new Date('2026-10-16T21:10:00.000Z');
const student: SelfCheckInStudent = {
  id: 's1',
  firstName: 'Lucía',
  lastName: 'Gómez',
  status: 'ACTIVE',
};
const salsa: SelfCheckInCandidate = {
  enrollmentId: 'e1',
  className: 'Salsa inicial',
  startTime: '18:00',
  endTime: '19:00',
  attendanceStatus: null,
};

describe('SelfCheckInService', () => {
  let repository: SelfCheckInRepository;
  let service: SelfCheckInService;

  beforeEach(() => {
    vi.stubEnv('BUSINESS_TIMEZONE', 'America/Buenos_Aires');
    repository = {
      findStudentByDni: vi.fn(async () => student),
      candidates: vi.fn(async () => [salsa]),
      markPresent: vi.fn(async () => undefined),
      hasOverdueCharges: vi.fn(async () => false),
    };
    service = new SelfCheckInService(repository);
  });

  it('marca presente en la clase del momento y avisa que está al día', async () => {
    await expect(service.checkIn('40111222', now)).resolves.toEqual({
      outcome: 'CHECKED_IN',
      student: { firstName: 'Lucía', lastName: 'Gómez' },
      class: { name: 'Salsa inicial', startTime: '18:00', endTime: '19:00' },
      paymentStatus: 'UP_TO_DATE',
    });
    expect(repository.markPresent).toHaveBeenCalledWith('e1', new Date('2026-10-16T00:00:00.000Z'));
    expect(repository.candidates).toHaveBeenCalledWith(
      's1',
      new Date('2026-10-16T00:00:00.000Z'),
      'FRIDAY',
    );
  });

  it('da el presente igual si debe cuotas vencidas, sin informar el monto', async () => {
    vi.mocked(repository.hasOverdueCharges).mockResolvedValue(true);
    const result = await service.checkIn('40111222', now);
    expect(result.outcome).toBe('CHECKED_IN');
    expect(result.paymentStatus).toBe('OVERDUE');
    expect(repository.markPresent).toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toMatch(/amount|monto|\d{4,}/i);
  });

  it('no duplica si ya tenía presente', async () => {
    vi.mocked(repository.candidates).mockResolvedValue([{ ...salsa, attendanceStatus: 'PRESENT' }]);
    const result = await service.checkIn('40111222', now);
    expect(result.outcome).toBe('ALREADY_CHECKED_IN');
    expect(repository.markPresent).not.toHaveBeenCalled();
  });

  it('no registra nada si no tiene clase en ese horario', async () => {
    vi.mocked(repository.candidates).mockResolvedValue([
      { ...salsa, startTime: '10:00', endTime: '11:00' },
    ]);
    const result = await service.checkIn('40111222', now);
    expect(result).toMatchObject({ outcome: 'NO_CLASS_NOW', class: null });
    expect(repository.markPresent).not.toHaveBeenCalled();
  });

  it('responde no encontrado para un DNI inexistente o un alumno inactivo, sin datos', async () => {
    vi.mocked(repository.findStudentByDni).mockResolvedValueOnce(null);
    await expect(service.checkIn('99999999', now)).resolves.toEqual({
      outcome: 'STUDENT_NOT_FOUND',
      student: null,
      class: null,
      paymentStatus: null,
    });
    vi.mocked(repository.findStudentByDni).mockResolvedValueOnce({
      ...student,
      status: 'INACTIVE',
    });
    await expect(service.checkIn('40111222', now)).resolves.toMatchObject({
      outcome: 'STUDENT_NOT_FOUND',
      student: null,
    });
    expect(repository.markPresent).not.toHaveBeenCalled();
  });

  it('busca el DNI de 7 dígitos escrito con un 0 adelante', async () => {
    await service.checkIn('08765432', now);
    expect(repository.findStudentByDni).toHaveBeenCalledWith(['08765432', '8765432']);
  });

  it('rechaza un DNI que no tenga 8 dígitos', async () => {
    await expect(service.checkIn('123', now)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
