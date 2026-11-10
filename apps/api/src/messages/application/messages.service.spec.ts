import { Prisma } from '@academy/database';
import { describe, expect, it, vi } from 'vitest';
import { rolePermissions } from '../../auth/domain/permissions';
import { PERMISSIONS_KEY } from '../../auth/presentation/permissions.decorator';
import type { PrismaService } from '../../database/prisma.service';
import { MessagesController } from '../presentation/messages.controller';
import { MessagesService } from './messages.service';

const now = new Date('2026-11-10T15:00:00.000Z');
const uuid = (digit: string) => `00000000-0000-4000-8000-00000000000${digit}`;
const decimal = (value: string) => new Prisma.Decimal(value);
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

const prismaMock = () => {
  const tx = {
    messageTemplate: {
      aggregate: vi.fn().mockResolvedValue({ _max: { sortOrder: 20 } }),
      create: vi
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: uuid('9'), status: 'ACTIVE', ...data }),
        ),
      findUnique: vi.fn().mockResolvedValue({
        id: uuid('8'),
        situation: 'BIRTHDAY',
        name: 'Feliz cumpleaños',
        body: '¡Feliz cumple, {nombre}! 🎂',
        status: 'ACTIVE',
      }),
      update: vi
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: uuid('8'), situation: 'BIRTHDAY', status: 'ACTIVE', ...data }),
        ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  return {
    tx,
    $transaction: vi.fn().mockImplementation((run: (client: typeof tx) => unknown) => run(tx)),
    $queryRaw: vi.fn().mockImplementation((sql: { strings: readonly string[] }) => {
      const text = sql.strings.join(' ');
      if (text.includes('open_charges'))
        return Promise.resolve([
          {
            id: uuid('2'),
            firstName: 'Bruno',
            lastName: 'Díaz',
            phone: '3704419087',
            charges: 1,
            amount: decimal('41000'),
            dueDate: date('2026-11-05'),
            total: decimal('41000'),
          },
          {
            id: uuid('1'),
            firstName: 'Ana María',
            lastName: 'Pérez',
            phone: null,
            charges: 2,
            amount: decimal('80000'),
            dueDate: date('2026-10-10'),
            total: decimal('120000'),
          },
        ]);
      if (text.includes('"consecutiveAbsences"'))
        return Promise.resolve([
          {
            id: uuid('1'),
            firstName: 'Ana',
            lastName: 'Pérez',
            phone: null,
            className: 'Heels',
            absences: 5,
          },
          {
            id: uuid('1'),
            firstName: 'Ana',
            lastName: 'Pérez',
            phone: null,
            className: 'Salsa',
            absences: 3,
          },
        ]);
      return Promise.resolve([]);
    }),
    student: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: uuid('3'),
          firstName: 'Caro',
          lastName: 'Sosa',
          phone: '1',
          birthDate: date('1990-11-12'),
        },
        {
          id: uuid('4'),
          firstName: 'Dana',
          lastName: 'Ríos',
          phone: '2',
          birthDate: date('1995-11-10'),
        },
        {
          id: uuid('5'),
          firstName: 'Eva',
          lastName: 'Luna',
          phone: '3',
          birthDate: date('1999-12-01'),
        },
      ]),
      findUnique: vi.fn().mockResolvedValue({ id: uuid('1') }),
    },
    lead: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: uuid('6'),
          name: 'Flor Gómez',
          phone: '370 503-2792',
          createdAt: new Date('2026-11-02T18:00:00.000Z'),
          trialClasses: [{ trialDate: date('2026-11-04'), academicClass: { name: 'Kizomba' } }],
        },
      ]),
      findUnique: vi.fn().mockResolvedValue({ id: uuid('6') }),
    },
    messageSend: {
      findMany: vi.fn().mockResolvedValue([
        {
          studentId: uuid('1'),
          leadId: null,
          createdAt: new Date('2026-11-07T15:00:00.000Z'),
          sentBy: { username: 'adriana' },
          template: { name: 'Recordatorio amable' },
        },
        {
          studentId: uuid('1'),
          leadId: null,
          createdAt: new Date('2026-11-01T15:00:00.000Z'),
          sentBy: { username: 'laura' },
          template: null,
        },
      ]),
      create: vi.fn().mockResolvedValue({
        createdAt: now,
        sentBy: { username: 'adriana' },
        template: { name: 'Recordatorio amable' },
      }),
    },
    messageTemplate: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: uuid('7'),
          situation: 'CHARGE_OVERDUE',
          name: 'Recordatorio amable',
          body: 'Hola {nombre}',
          status: 'ACTIVE',
        },
      ]),
      findUnique: vi.fn().mockResolvedValue({ situation: 'CHARGE_OVERDUE' }),
    },
  };
};
const service = (prisma: ReturnType<typeof prismaMock>) =>
  new MessagesService(prisma as unknown as PrismaService);

describe('MessagesService', () => {
  it('lista las cuotas vencidas de la más antigua a la más nueva, con los datos del mensaje', async () => {
    const result = await service(prismaMock()).recipients('CHARGE_OVERDUE', now);
    expect(result.businessDate).toBe('2026-11-10');
    expect(result.recipients.map((item) => item.name)).toEqual(['Ana María Pérez', 'Bruno Díaz']);
    const ana = result.recipients[0]!;
    expect(ana.kind).toBe('STUDENT');
    expect(ana.detail).toMatch(/^2 cuotas · \$\s?80\.000,00 · venció el 10\/10$/);
    expect(ana.variables).toMatchObject({
      nombre: 'Ana',
      cuotas: '2 cuotas',
      vencimiento: '10/10',
    });
    expect(ana.variables.saldo_vencido).toMatch(/80\.000,00/);
    expect(ana.variables.saldo_total).toMatch(/120\.000,00/);
    // El envío más reciente de cada persona.
    expect(ana.lastSend).toEqual({
      sentAt: '2026-11-07T15:00:00.000Z',
      sentBy: 'adriana',
      templateName: 'Recordatorio amable',
    });
    expect(result.recipients[1]!.lastSend).toBeNull();
    expect(result.templates).toHaveLength(1);
  });

  it('la cuota por vencer usa el saldo y no el saldo vencido', async () => {
    const result = await service(prismaMock()).recipients('CHARGE_DUE_SOON', now);
    expect(result.recipients[0]!.detail).toContain('vence el');
    expect(Object.keys(result.recipients[0]!.variables).sort()).toEqual([
      'cuotas',
      'nombre',
      'saldo',
      'vencimiento',
    ]);
  });

  it('un alumno con ausencias en varias clases aparece una sola vez', async () => {
    const result = await service(prismaMock()).recipients('ABSENCES', now);
    expect(result.recipients).toHaveLength(1);
    expect(result.recipients[0]).toMatchObject({
      detail: '5 ausencias seguidas en Heels',
      variables: { nombre: 'Ana', clase: 'Heels', ausencias: '5' },
    });
  });

  it('cumpleaños: hoy y los próximos 7 días, del más cercano al más lejano', async () => {
    const result = await service(prismaMock()).recipients('BIRTHDAY', now);
    expect(result.recipients.map((item) => [item.name, item.detail])).toEqual([
      ['Dana Ríos', 'Cumple hoy'],
      ['Caro Sosa', 'Cumple el 12/11'],
    ]);
  });

  it('los potenciales llevan su clase de prueba', async () => {
    const result = await service(prismaMock()).recipients('LEAD_TRIAL_NOT_ENROLLED', now);
    expect(result.recipients[0]).toMatchObject({
      kind: 'LEAD',
      name: 'Flor Gómez',
      detail: 'Probó Kizomba el 04/11',
      variables: { nombre: 'Flor', clase: 'Kizomba' },
    });
  });

  it('cuenta las personas de las ocho situaciones', async () => {
    const situations = await service(prismaMock()).situations(now);
    expect(situations).toHaveLength(8);
    expect(situations.find((item) => item.situation === 'CHARGE_OVERDUE')).toMatchObject({
      group: 'Pagos',
      label: 'Cuota vencida',
      count: 2,
    });
    expect(situations.find((item) => item.situation === 'BIRTHDAY')!.count).toBe(2);
  });

  it('rechaza una situación desconocida', async () => {
    await expect(service(prismaMock()).recipients('OTRA', now)).rejects.toThrow('situación');
  });

  it('crea un mensaje al final de su situación y lo audita', async () => {
    const prisma = prismaMock();
    const created = await service(prisma).createTemplate(
      { situation: 'BIRTHDAY', name: ' Saludo ', body: '¡Feliz cumple {nombre}! 🎉' },
      uuid('0'),
    );
    expect(created).toMatchObject({ situation: 'BIRTHDAY', name: 'Saludo', status: 'ACTIVE' });
    expect(prisma.tx.messageTemplate.create).toHaveBeenCalledWith({
      data: {
        situation: 'BIRTHDAY',
        name: 'Saludo',
        body: '¡Feliz cumple {nombre}! 🎉',
        sortOrder: 30,
      },
    });
    expect(prisma.tx.auditLog.create).toHaveBeenCalledOnce();
    await expect(
      service(prismaMock()).createTemplate(
        { situation: 'BIRTHDAY', name: 'Saludo', body: 'Debés {saldo}' },
        uuid('0'),
      ),
    ).rejects.toThrow('no puede usar {saldo}');
  });

  it('da de baja un mensaje sin tocar su texto', async () => {
    const prisma = prismaMock();
    await service(prisma).updateTemplate(uuid('8'), { status: 'INACTIVE' }, uuid('0'));
    expect(prisma.tx.messageTemplate.update).toHaveBeenCalledWith({
      where: { id: uuid('8') },
      data: { name: 'Feliz cumpleaños', body: '¡Feliz cumple, {nombre}! 🎂', status: 'INACTIVE' },
    });
  });

  it('registra el envío para un alumno o un potencial, nunca los dos', async () => {
    const prisma = prismaMock();
    const sent = await service(prisma).registerSend(
      {
        situation: 'CHARGE_OVERDUE',
        templateId: uuid('7'),
        studentId: uuid('1'),
        body: ' Hola Ana ',
      },
      uuid('0'),
    );
    expect(sent).toEqual({
      sentAt: now.toISOString(),
      sentBy: 'adriana',
      templateName: 'Recordatorio amable',
    });
    expect(prisma.messageSend.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          situation: 'CHARGE_OVERDUE',
          templateId: uuid('7'),
          studentId: uuid('1'),
          leadId: null,
          body: 'Hola Ana',
          sentByUserId: uuid('0'),
        },
      }),
    );
    const invalid = { situation: 'CHARGE_OVERDUE', body: 'Hola' } as const;
    await expect(service(prismaMock()).registerSend(invalid, uuid('0'))).rejects.toThrow('alumno');
    await expect(
      service(prismaMock()).registerSend(
        { ...invalid, studentId: uuid('1'), leadId: uuid('6') },
        uuid('0'),
      ),
    ).rejects.toThrow('alumno');
    // El mensaje elegido tiene que ser de esa situación.
    await expect(
      service(prismaMock()).registerSend(
        { situation: 'BIRTHDAY', templateId: uuid('7'), studentId: uuid('1'), body: 'Hola' },
        uuid('0'),
      ),
    ).rejects.toThrow('Mensaje no encontrado');
  });
});

describe('Mensajes: límites de autorización', () => {
  it('envían los tres roles; los mensajes los editan Administración y Dirección', () => {
    const prototype = MessagesController.prototype as unknown as Record<string, object>;
    const permission = (name: string) => Reflect.getMetadata(PERMISSIONS_KEY, prototype[name]!);
    for (const name of ['situations', 'recipients', 'registerSend'])
      expect(permission(name)).toEqual(['students:manage']);
    for (const name of ['createTemplate', 'updateTemplate'])
      expect(permission(name)).toEqual(['messages:manage']);
    expect(rolePermissions.RECEPTION).toContain('students:manage');
    expect(rolePermissions.RECEPTION).not.toContain('messages:manage');
    expect(rolePermissions.MANAGER).toContain('messages:manage');
    expect(rolePermissions.ADMINISTRATOR).toContain('messages:manage');
  });
});
