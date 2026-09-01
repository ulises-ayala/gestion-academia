import type { CreateStudentOnboardingDto } from '@academy/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  StudentOnboardingOperations,
  StudentOnboardingTransaction,
} from './student-onboarding.transaction';
import { StudentOnboardingService } from './student-onboarding.service';

const student = {
  id: 'student-1',
  dni: '30111222',
  firstName: 'Ana',
  lastName: 'Pérez',
  birthDate: null,
  phone: null,
  email: null,
  address: null,
  joinedAt: new Date('2026-08-28T00:00:00Z'),
  status: 'ACTIVE',
  createdAt: new Date('2026-08-28T00:00:00Z'),
  updatedAt: new Date('2026-08-28T00:00:00Z'),
};
const enrollment = (id: string, classId: string) => ({ id, studentId: student.id, classId });
const charge = (id: string, enrollmentId: string) => ({
  id,
  enrollmentId,
  finalAmount: '40000.00',
  studentDueAmount: '40000.00',
});
const base: CreateStudentOnboardingDto = {
  student: { dni: student.dni, firstName: student.firstName, lastName: student.lastName },
  enrollments: [],
};

describe('StudentOnboardingService', () => {
  let operations: StudentOnboardingOperations;
  let transaction: StudentOnboardingTransaction;
  let service: StudentOnboardingService;

  beforeEach(() => {
    operations = {
      students: { create: vi.fn().mockResolvedValue(student) },
      enrollments: {
        create: vi
          .fn()
          .mockImplementation(({ classId }) =>
            Promise.resolve(enrollment(`enrollment-${classId}`, classId)),
          ),
      },
      billing: {
        createCharge: vi
          .fn()
          .mockImplementation(({ enrollmentId }) =>
            Promise.resolve(charge(`charge-${enrollmentId}`, enrollmentId)),
          ),
      },
      payments: {
        create: vi.fn().mockImplementation(({ tenders }, actorId) =>
          Promise.resolve({
            id: 'payment-1',
            amount: '80000.00',
            status: 'CONFIRMED',
            allocations: [
              { monthlyChargeId: 'charge-enrollment-class-a' },
              { monthlyChargeId: 'charge-enrollment-class-b' },
            ],
            tenders,
            actorId,
          }),
        ),
      },
    } as unknown as StudentOnboardingOperations;
    transaction = { execute: vi.fn((work) => work(operations)) };
    service = new StudentOnboardingService(transaction);
  });

  it('preserva el alta simple sin inscripciones, cuotas ni pago', async () => {
    await expect(service.create(base, 'actor-1')).resolves.toMatchObject({
      student: { id: student.id },
      enrollments: [],
      charges: [],
      payment: null,
    });
    expect(operations.enrollments.create).not.toHaveBeenCalled();
    expect(operations.billing.createCharge).not.toHaveBeenCalled();
    expect(operations.payments.create).not.toHaveBeenCalled();
  });

  it('crea N inscripciones y N cuotas pendientes dentro de una transacción', async () => {
    const result = await service.create(
      {
        ...base,
        enrollments: [
          { classId: 'class-b', tariffId: 'tariff-1' },
          { classId: 'class-a', tariffId: 'tariff-2' },
        ],
        period: '2026-08',
        dueDate: '2026-08-10',
      },
      'actor-1',
    );
    expect(result.enrollments).toHaveLength(2);
    expect(result.charges).toHaveLength(2);
    expect(result.payment).toBeNull();
    expect(operations.enrollments.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ classId: 'class-a' }),
    );
  });

  it('crea un único pago para todas las cuotas sin aceptar amount del cliente', async () => {
    const result = await service.create(
      {
        ...base,
        enrollments: [
          { classId: 'class-a', tariffId: 'tariff-1' },
          { classId: 'class-b', tariffId: 'tariff-1' },
        ],
        period: '2026-08',
        dueDate: '2026-08-10',
        payment: { paymentMethod: 'CASH' },
      },
      'actor-1',
    );
    expect(operations.payments.create).toHaveBeenCalledOnce();
    expect(operations.payments.create).toHaveBeenCalledWith(
      {
        studentId: 'student-1',
        tenders: [{ method: 'CASH', amount: '80000.00' }],
      },
      'actor-1',
    );
    expect(result.payment).toMatchObject({ status: 'CONFIRMED', allocations: [{}, {}] });
  });

  it('rechaza una clase repetida antes de abrir la transacción', () => {
    expect(() =>
      service.create(
        {
          ...base,
          enrollments: [
            { classId: 'class-a', tariffId: 'tariff-1' },
            { classId: 'class-a', tariffId: 'tariff-2' },
          ],
          period: '2026-08',
          dueDate: '2026-08-10',
        },
        'actor-1',
      ),
    ).toThrowError(expect.objectContaining({ code: 'ONBOARDING_DUPLICATE_CLASS' }));
    expect(transaction.execute).not.toHaveBeenCalled();
  });

  it('propaga un fallo intermedio a la transacción para que haga rollback', async () => {
    vi.mocked(operations.billing.createCharge).mockRejectedValueOnce(new Error('tarifa inválida'));
    await expect(
      service.create(
        {
          ...base,
          enrollments: [{ classId: 'class-a', tariffId: 'tariff-1' }],
          period: '2026-08',
          dueDate: '2026-08-10',
        },
        'actor-1',
      ),
    ).rejects.toThrow('tarifa inválida');
    expect(operations.payments.create).not.toHaveBeenCalled();
  });
});
