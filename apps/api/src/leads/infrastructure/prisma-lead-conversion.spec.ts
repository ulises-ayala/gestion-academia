import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../database/prisma.service';
import { PrismaLeadConversion } from './prisma-lead-conversion';

const prismaMock = (lead: { id: string; status: string; studentId: string | null } | null) => ({
  lead: {
    findUnique: vi.fn().mockResolvedValue(lead),
    update: vi.fn().mockResolvedValue({}),
  },
  auditLog: { create: vi.fn().mockResolvedValue({}) },
});
const conversion = (prisma: ReturnType<typeof prismaMock>) =>
  new PrismaLeadConversion(prisma as unknown as PrismaService);

describe('Potencial alumno que se inscribe', () => {
  it('queda inscripto, vinculado al alumno y auditado', async () => {
    const prisma = prismaMock({ id: 'lead-1', status: 'TRIAL', studentId: null });
    await conversion(prisma).markEnrolled('lead-1', 'student-1', 'actor-1');
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: { status: 'ENROLLED', studentId: 'student-1' },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: 'actor-1',
        action: 'UPDATE',
        entityType: 'LEAD',
        entityId: 'lead-1',
        before: { status: 'TRIAL', studentId: null },
        after: { status: 'ENROLLED', studentId: 'student-1' },
        metadata: { source: 'LEAD_CONVERSION' },
      },
    });
  });

  it('se puede convertir aunque se haya marcado "No concretó" o "Inscripto/a" a mano', async () => {
    for (const status of ['NOT_CONVERTED', 'ENROLLED']) {
      const prisma = prismaMock({ id: 'lead-1', status, studentId: null });
      await conversion(prisma).markEnrolled('lead-1', 'student-1', 'actor-1');
      expect(prisma.lead.update).toHaveBeenCalledOnce();
    }
  });

  it('no se convierte dos veces ni si no existe', async () => {
    const linked = prismaMock({ id: 'lead-1', status: 'ENROLLED', studentId: 'student-0' });
    await expect(conversion(linked).markEnrolled('lead-1', 'student-1', 'actor-1')).rejects.toThrow(
      expect.objectContaining({ code: 'LEAD_CONVERSION_CONFLICT' }),
    );
    expect(linked.lead.update).not.toHaveBeenCalled();
    expect(linked.auditLog.create).not.toHaveBeenCalled();

    await expect(
      conversion(prismaMock(null)).markEnrolled('lead-9', 'student-1', 'actor-1'),
    ).rejects.toThrow(expect.objectContaining({ code: 'LEAD_NOT_FOUND' }));
  });
});
