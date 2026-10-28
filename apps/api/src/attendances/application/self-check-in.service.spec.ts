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
  scheduleId: 'h1',
  className: 'Salsa inicial',
  teacherName: 'José Barrios',
  roomName: 'Salón principal',
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
      class: {
        name: 'Salsa inicial',
        startTime: '18:00',
        endTime: '19:00',
        teacherName: 'José Barrios',
        roomName: 'Salón principal',
      },
      paymentStatus: 'UP_TO_DATE',
    });
    expect(repository.markPresent).toHaveBeenCalledWith(
      'e1',
      'h1',
      new Date('2026-10-16T00:00:00.000Z'),
    );
    expect(repository.candidates).toHaveBeenCalledWith(
      's1',
      new Date('2026-10-16T00:00:00.000Z'),
      'FRIDAY',
    );
  });

  it('en el segundo horario de la misma clase marca ese horario aunque ya tenga el primero', async () => {
    vi.mocked(repository.candidates).mockResolvedValue([
      { ...salsa, startTime: '17:00', endTime: '18:00', attendanceStatus: 'PRESENT' },
      { ...salsa, scheduleId: 'h2' },
    ]);
    const result = await service.checkIn('40111222', now);
    expect(result.outcome).toBe('CHECKED_IN');
    expect(result.class?.startTime).toBe('18:00');
    expect(repository.markPresent).toHaveBeenCalledWith(
      'e1',
      'h2',
      new Date('2026-10-16T00:00:00.000Z'),
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

  it('una noche con varias clases: cada DNI marca el horario que corresponde', async () => {
    // Viernes 16/10: Salsa 19 h, Bachata 20 h y otra vez Salsa 21 h (misma inscripción).
    const turns = [
      { enrollmentId: 'e-salsa', scheduleId: 'h19', name: 'Salsa', start: '19:00', end: '20:00' },
      {
        enrollmentId: 'e-bachata',
        scheduleId: 'h20',
        name: 'Bachata',
        start: '20:00',
        end: '21:00',
      },
      { enrollmentId: 'e-salsa', scheduleId: 'h21', name: 'Salsa', start: '21:00', end: '22:00' },
    ];
    const present = new Set<string>();
    repository.candidates = vi.fn(async () =>
      turns.map((turn) => ({
        enrollmentId: turn.enrollmentId,
        scheduleId: turn.scheduleId,
        className: turn.name,
        teacherName: 'José Barrios',
        roomName: 'Salón principal',
        startTime: turn.start,
        endTime: turn.end,
        attendanceStatus: present.has(`${turn.enrollmentId}|${turn.scheduleId}`)
          ? ('PRESENT' as const)
          : null,
      })),
    );
    repository.markPresent = vi.fn(async (enrollmentId: string, scheduleId: string) => {
      present.add(`${enrollmentId}|${scheduleId}`);
    });
    const at = async (localTime: string) => {
      const [hours, minutes] = localTime.split(':').map(Number);
      const result = await service.checkIn(
        '40111222',
        new Date(Date.UTC(2026, 9, 16, hours! + 3, minutes!)),
      );
      return `${result.outcome} ${result.class?.name ?? '-'} ${result.class?.startTime ?? ''}`;
    };

    expect(await at('18:45')).toBe('CHECKED_IN Salsa 19:00');
    expect(await at('18:50')).toBe('ALREADY_CHECKED_IN Salsa 19:00');
    expect(await at('19:50')).toBe('CHECKED_IN Bachata 20:00');
    expect(await at('20:45')).toBe('CHECKED_IN Salsa 21:00');
    expect(await at('21:05')).toBe('ALREADY_CHECKED_IN Salsa 21:00');
    expect([...present]).toEqual(['e-salsa|h19', 'e-bachata|h20', 'e-salsa|h21']);
  });
});
