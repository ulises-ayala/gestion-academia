import {
  AdminRole,
  AttendanceStatus,
  DayOfWeek,
  EnrollmentStatus,
  MonthlyChargeStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  RecordStatus,
} from '@prisma/client';
import { hashPassword } from '../../../../apps/api/src/auth/domain/password';
import { validateSeedDataset } from './dataset-validation';

const timeZone = 'America/Argentina/Buenos_Aires';

const uuid = (group: string, position: number) =>
  `${group}0000000-0000-4000-8000-${String(position).padStart(12, '0')}`;

const dateOnly = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day));

const buenosAiresToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return dateOnly(Number(value.year), Number(value.month), Number(value.day));
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const firstDayOfMonth = (date: Date) => dateOnly(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);

const dayOfWeekFor = (date: Date): DayOfWeek =>
  [
    DayOfWeek.SUNDAY,
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
    DayOfWeek.SATURDAY,
  ][date.getUTCDay()]!;

const time = (hours: number, minutes = 0) => new Date(Date.UTC(1970, 0, 1, hours, minutes));

export const students = [
  ['30100001', 'Ana', 'Pérez'],
  ['30100002', 'Bruno', 'Gómez'],
  ['30100003', 'Carla', 'Rodríguez'],
  ['30100004', 'Diego', 'Fernández'],
  ['30100005', 'Elena', 'López'],
  ['30100006', 'Facundo', 'Martínez'],
  ['30100007', 'Gabriela', 'Sánchez'],
  ['30100008', 'Hernán', 'Romero'],
  ['30100009', 'Inés', 'Díaz'],
  ['30100010', 'Julián', 'Álvarez'],
  ['30100011', 'Karen', 'Ruiz'],
  ['30100012', 'Lucas', 'Torres'],
  ['30100013', 'Marina', 'Acosta'],
  ['30100014', 'Nicolás', 'Benítez'],
  ['30100015', 'Olivia', 'Medina'],
  ['30100016', 'Pablo', 'Herrera'],
  ['30100017', 'Raquel', 'Suárez'],
  ['30100018', 'Santiago', 'Aguirre'],
  ['30100019', 'Tamara', 'Castro'],
  ['30100020', 'Ulises', 'Molina'],
  ['30100021', 'Valentina', 'Ortiz'],
  ['30100022', 'Walter', 'Silva'],
  ['30100023', 'Ximena', 'Rojas'],
  ['30100024', 'Yamila', 'Navarro'],
  ['30100025', 'Zoe', 'Vega'],
  ['30100026', 'Agustín', 'Paz'],
  ['30100027', 'Belén', 'Cabrera'],
  ['30100028', 'Ciro', 'Ibarra'],
] as const;

export const teachers = [
  ['20100001', 'Lucía', 'Moreno'],
  ['20100002', 'Mateo', 'Vargas'],
  ['20100003', 'Sofía', 'Ramos'],
  ['20100004', 'Tomás', 'Giménez'],
  ['20100005', 'Camila', 'Peralta'],
  ['20100006', 'Leandro', 'Núñez'],
] as const;

export const danceTypes = [
  ['Bachata', 'bachata'],
  ['Salsa', 'salsa'],
  ['Urbano', 'urbano'],
  ['Kizomba', 'kizomba'],
] as const;

export type SeedMode = 'development' | 'staging';

export const applySeedData = async (
  prisma: PrismaClient,
  options: Readonly<{ password: string; mode: SeedMode }>,
) => {
  const today = buenosAiresToday();
  const currentPeriod = firstDayOfMonth(today);
  const previousPeriod = firstDayOfMonth(addDays(currentPeriod, -1));
  validateSeedDataset({
    studentDnis: students.map(([dni]) => dni),
    classCapacities: [25, 25, 20, 20, 24, 30, 20, 18, 20],
    schedules: [
      { classIndex: 0, dayOfWeek: dayOfWeekFor(today), startHour: 18, endHour: 19 },
      { classIndex: 1, dayOfWeek: dayOfWeekFor(today), startHour: 19, endHour: 20 },
      { classIndex: 2, dayOfWeek: DayOfWeek.MONDAY, startHour: 18, endHour: 19 },
      { classIndex: 3, dayOfWeek: DayOfWeek.TUESDAY, startHour: 20, endHour: 21 },
      { classIndex: 4, dayOfWeek: DayOfWeek.WEDNESDAY, startHour: 20, endHour: 21 },
      { classIndex: 5, dayOfWeek: DayOfWeek.THURSDAY, startHour: 19, endHour: 20 },
      { classIndex: 6, dayOfWeek: DayOfWeek.FRIDAY, startHour: 20, endHour: 21 },
      { classIndex: 7, dayOfWeek: DayOfWeek.SATURDAY, startHour: 10, endHour: 11 },
      { classIndex: 8, dayOfWeek: DayOfWeek.SUNDAY, startHour: 17, endHour: 18 },
    ],
    enrollments: [
      [0, 0, -30, null],
      [1, 0, -40, null],
      [1, 1, -40, null],
      [2, 2, -120, -30],
      [4, 0, -60, null],
      [4, 3, -50, null],
      [4, 4, -20, null],
      [5, 5, -2, null],
      [6, 6, -120, -60],
      [7, 1, -45, null],
      [8, 2, -35, null],
      [9, 3, -28, null],
      [10, 4, -25, null],
      [11, 5, -22, null],
      [12, 6, -20, null],
      [13, 7, -18, null],
      [14, 8, -16, null],
      [15, 0, -15, null],
      [16, 1, -14, null],
      [17, 2, -12, null],
      [18, 3, -10, null],
      [19, 4, -8, null],
      [20, 5, -6, null],
      [21, 6, -4, null],
      [22, 7, -1, null],
    ].map(([studentIndex, classIndex, startOffset, endOffset]) => ({
      studentIndex: studentIndex!,
      classIndex: classIndex!,
      startOffset: startOffset!,
      endOffset,
    })),
    attendances: [
      [1, 0],
      [4, -1],
      [5, -1],
      [3, -45],
      [7, -1],
      [9, -7],
      [10, -7],
      [11, -5],
    ].map(([enrollmentIndex, dateOffset]) => ({
      enrollmentIndex: enrollmentIndex!,
      dateOffset: dateOffset!,
    })),
    charges: [0, 1, 2, 4, 5, 6, 7, 9, 10, 11, 12, 13]
      .map((enrollmentIndex) => ({
        enrollmentIndex,
        period: 'current',
        status: 'PENDING' as const,
      }))
      .concat([{ enrollmentIndex: 3, period: 'previous', status: 'PAID' as const }]),
    payments: [
      {
        studentIndex: 2,
        amount: 35000,
        status: PaymentStatus.CONFIRMED,
        paymentMethod: PaymentMethod.CASH,
        allocations: [{ chargeIndex: 12, studentIndex: 2, amount: 35000 }],
      },
      {
        studentIndex: 4,
        amount: 40000,
        status: PaymentStatus.VOID,
        paymentMethod: PaymentMethod.MERCADO_PAGO,
        allocations: [{ chargeIndex: 3, studentIndex: 4, amount: 40000 }],
      },
    ],
  });
  const passwordHash = await hashPassword(options.password);

  const summary = await prisma.$transaction(
    async (tx) => {
      const usernamePrefix = options.mode === 'staging' ? 'demo-' : '';
      const adminDefinitions = [
        [`${usernamePrefix}admision`, AdminRole.RECEPTION],
        [`${usernamePrefix}administracion`, AdminRole.MANAGER],
        [`${usernamePrefix}direccion`, AdminRole.ADMINISTRATOR],
      ] as const;
      for (const [index, [username, role]] of adminDefinitions.entries()) {
        await tx.adminUser.upsert({
          where: { username },
          create: {
            id: uuid('b', index + 1),
            username,
            passwordHash,
            role,
            status: RecordStatus.ACTIVE,
          },
          update: { passwordHash, role, status: RecordStatus.ACTIVE },
        });
      }

      const studentIds: string[] = [];
      for (const [index, [dni, firstName, lastName]] of students.entries()) {
        const student = await tx.student.upsert({
          where: { dni },
          create: {
            id: uuid('1', index + 1),
            dni,
            firstName,
            lastName,
            birthDate: dateOnly(1990 + (index % 12), (index % 12) + 1, (index % 25) + 1),
            phone: `11 5555-${String(1000 + index)}`,
            email: `${firstName
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')}.${lastName
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')}@example.test`,
            address: `Domicilio de prueba ${index + 1}, CABA`,
            joinedAt: addDays(today, -(30 + index)),
            status: index === 27 ? RecordStatus.INACTIVE : RecordStatus.ACTIVE,
          },
          update: {
            firstName,
            lastName,
            status: index === 27 ? RecordStatus.INACTIVE : RecordStatus.ACTIVE,
          },
        });
        studentIds.push(student.id);
      }

      const teacherIds: string[] = [];
      for (const [index, [dni, firstName, lastName]] of teachers.entries()) {
        const teacher = await tx.teacher.upsert({
          where: { dni },
          create: {
            id: uuid('2', index + 1),
            dni,
            firstName,
            lastName,
            phone: `11 4444-${String(2000 + index)}`,
            email: `${firstName.toLowerCase()}@profesores.example.test`,
            status: RecordStatus.ACTIVE,
          },
          update: { firstName, lastName, status: RecordStatus.ACTIVE },
        });
        teacherIds.push(teacher.id);
      }

      const danceTypeIds: string[] = [];
      for (const [index, [name, normalizedName]] of danceTypes.entries()) {
        const danceType = await tx.danceType.upsert({
          where: { normalizedName },
          create: {
            id: uuid('3', index + 1),
            name,
            normalizedName,
            description: `${name} para datos de demostración local`,
          },
          update: {
            name,
            description: `${name} para datos de demostración local`,
            status: RecordStatus.ACTIVE,
          },
        });
        danceTypeIds.push(danceType.id);
      }

      const branchDefinitions = [
        [uuid('4', 1), 'Sede Centro', 'Av. Corrientes 1500, CABA'],
        [uuid('4', 2), 'Sede Palermo', 'Av. Santa Fe 3900, CABA'],
      ] as const;
      for (const [id, name, address] of branchDefinitions) {
        await tx.branch.upsert({
          where: { id },
          create: { id, name, address },
          update: { name, address, status: RecordStatus.ACTIVE },
        });
      }

      const roomDefinitions = [
        [uuid('5', 1), 'Salón Rojo', 30, uuid('4', 1)],
        [uuid('5', 2), 'Salón Azul', 24, uuid('4', 1)],
        [uuid('5', 3), 'Salón Norte', 28, uuid('4', 2)],
        [uuid('5', 4), 'Salón Sur', 20, uuid('4', 2)],
      ] as const;
      for (const [id, name, capacity, branchId] of roomDefinitions) {
        await tx.room.upsert({
          where: { id },
          create: { id, name, capacity, branchId },
          update: { name, capacity, branchId, status: RecordStatus.ACTIVE },
        });
      }

      const classDefinitions = [
        ['Bachata Inicial', 0, 0, 'Inicial', 25],
        ['Salsa Intermedia', 1, 1, 'Intermedio', 25],
        ['Urbano Inicial', 2, 2, 'Inicial', 20],
        ['Kizomba Inicial', 3, 3, 'Inicial', 20],
        ['Bachata Intermedia', 0, 4, 'Intermedio', 24],
        ['Salsa Inicial', 1, 5, 'Inicial', 30],
        ['Kizomba Intermedia', 3, 1, 'Intermedio', 20],
        ['Urbano Coreográfico', 2, 2, 'Avanzado', 18],
        ['Salsa Avanzada', 1, 3, 'Avanzado', 20],
      ] as const;
      for (const [
        index,
        [name, danceIndex, teacherIndex, level, capacity],
      ] of classDefinitions.entries()) {
        const id = uuid('6', index + 1);
        const data = {
          name,
          danceTypeId: danceTypeIds[danceIndex]!,
          teacherId: teacherIds[teacherIndex]!,
          level,
          capacity,
          status: RecordStatus.ACTIVE,
        };
        await tx.academyClass.upsert({ where: { id }, create: { id, ...data }, update: data });
      }

      const scheduleDefinitions = [
        [dayOfWeekFor(today), 18, 19, 0],
        [dayOfWeekFor(today), 19, 20, 0],
        [DayOfWeek.MONDAY, 18, 19, 1],
        [DayOfWeek.TUESDAY, 20, 21, 2],
        [DayOfWeek.WEDNESDAY, 20, 21, 3],
        [DayOfWeek.THURSDAY, 19, 20, 1],
        [DayOfWeek.FRIDAY, 20, 21, 2],
        [DayOfWeek.SATURDAY, 10, 11, 3],
        [DayOfWeek.SUNDAY, 17, 18, 0],
      ] as const;
      for (const [
        index,
        [dayOfWeek, startHour, endHour, roomIndex],
      ] of scheduleDefinitions.entries()) {
        const id = uuid('c', index + 1);
        const data = {
          classId: uuid('6', index + 1),
          dayOfWeek,
          startTime: time(startHour),
          endTime: time(endHour),
          roomId: roomDefinitions[roomIndex]![0],
          status: RecordStatus.ACTIVE,
        };
        await tx.classSchedule.upsert({ where: { id }, create: { id, ...data }, update: data });
      }

      const enrollmentDefinitions = [
        [0, 0, -30, null],
        [1, 0, -40, null],
        [1, 1, -40, null],
        [2, 2, -120, -30],
        [4, 0, -60, null],
        [4, 3, -50, null],
        [4, 4, -20, null],
        [5, 5, -2, null],
        [6, 6, -120, -60],
        [7, 1, -45, null],
        [8, 2, -35, null],
        [9, 3, -28, null],
        [10, 4, -25, null],
        [11, 5, -22, null],
        [12, 6, -20, null],
        [13, 7, -18, null],
        [14, 8, -16, null],
        [15, 0, -15, null],
        [16, 1, -14, null],
        [17, 2, -12, null],
        [18, 3, -10, null],
        [19, 4, -8, null],
        [20, 5, -6, null],
        [21, 6, -4, null],
        [22, 7, -1, null],
      ] as const;
      for (const [
        index,
        [studentIndex, classIndex, startOffset, endOffset],
      ] of enrollmentDefinitions.entries()) {
        const id = uuid('7', index + 1);
        const ended = endOffset !== null;
        const data = {
          studentId: studentIds[studentIndex]!,
          classId: uuid('6', classIndex + 1),
          startDate: addDays(today, startOffset),
          endDate: ended ? addDays(today, endOffset) : null,
          status: ended ? EnrollmentStatus.ENDED : EnrollmentStatus.ACTIVE,
        };
        await tx.enrollment.upsert({ where: { id }, create: { id, ...data }, update: data });
      }

      const tariffDefinitions = [
        [
          uuid('9', 1),
          'Tarifa general vigente',
          40000,
          addDays(currentPeriod, -365),
          null,
          RecordStatus.ACTIVE,
        ],
        [
          uuid('9', 2),
          'Tarifa histórica',
          35000,
          addDays(previousPeriod, -365),
          addDays(previousPeriod, -1),
          RecordStatus.INACTIVE,
        ],
      ] as const;
      for (const [id, name, amount, validFrom, validTo, status] of tariffDefinitions) {
        const data = { name, amount, validFrom, validTo, status };
        await tx.tariff.upsert({ where: { id }, create: { id, ...data }, update: data });
      }

      const chargeEnrollmentIndexes = [0, 1, 2, 4, 5, 6, 7, 9, 10, 11, 12, 13];
      for (const [index, enrollmentIndex] of chargeEnrollmentIndexes.entries()) {
        const enrollment = enrollmentDefinitions[enrollmentIndex]!;
        const amount = index === 6 ? 36000 : 40000;
        const discountAmount = index === 6 ? 4000 : 0;
        const id = uuid('a', index + 1);
        const data = {
          studentId: studentIds[enrollment[0]]!,
          enrollmentId: uuid('7', enrollmentIndex + 1),
          tariffId: uuid('9', 1),
          period: currentPeriod,
          baseAmount: 40000,
          discountAmount,
          finalAmount: amount,
          dueDate: addDays(currentPeriod, 9),
          status: MonthlyChargeStatus.PENDING,
        };
        await tx.monthlyCharge.upsert({ where: { id }, create: { id, ...data }, update: data });
      }

      const historicalCharge = {
        studentId: studentIds[2]!,
        enrollmentId: uuid('7', 4),
        tariffId: uuid('9', 2),
        period: previousPeriod,
        baseAmount: 35000,
        discountAmount: 0,
        finalAmount: 35000,
        dueDate: addDays(previousPeriod, 9),
        status: MonthlyChargeStatus.PAID,
      };
      await tx.monthlyCharge.upsert({
        where: { id: uuid('a', 13) },
        create: { id: uuid('a', 13), ...historicalCharge },
        update: historicalCharge,
      });

      const paymentDefinitions = [
        {
          id: uuid('d', 1),
          studentId: studentIds[2]!,
          amount: 35000,
          paymentMethod: PaymentMethod.CASH,
          status: PaymentStatus.CONFIRMED,
          paidAt: addDays(today, -15),
          createdByUserId: uuid('b', 1),
          voidedAt: null,
          voidedByUserId: null,
          chargeId: uuid('a', 13),
        },
        {
          id: uuid('d', 2),
          studentId: studentIds[4]!,
          amount: 40000,
          paymentMethod: PaymentMethod.MERCADO_PAGO,
          status: PaymentStatus.VOID,
          paidAt: addDays(today, -10),
          createdByUserId: uuid('b', 1),
          voidedAt: addDays(today, -9),
          voidedByUserId: uuid('b', 2),
          chargeId: uuid('a', 4),
        },
      ] as const;
      for (const [index, definition] of paymentDefinitions.entries()) {
        const { chargeId, ...payment } = definition;
        await tx.payment.upsert({ where: { id: payment.id }, create: payment, update: payment });
        const allocation = {
          paymentId: payment.id,
          monthlyChargeId: chargeId,
          amount: payment.amount,
        };
        await tx.paymentAllocation.upsert({
          where: { id: uuid('e', index + 1) },
          create: { id: uuid('e', index + 1), ...allocation },
          update: allocation,
        });
      }

      const attendanceDefinitions = [
        [1, 0, AttendanceStatus.PRESENT, 'Ya cargada para probar corrección'],
        [4, -1, AttendanceStatus.ABSENT, null],
        [5, -1, AttendanceStatus.JUSTIFIED, 'Avisó por enfermedad'],
        [3, -45, AttendanceStatus.PRESENT, 'Histórica sobre inscripción finalizada'],
        [7, -1, AttendanceStatus.PRESENT, null],
        [9, -7, AttendanceStatus.PRESENT, null],
        [10, -7, AttendanceStatus.ABSENT, null],
        [11, -5, AttendanceStatus.JUSTIFIED, 'Viaje'],
      ] as const;
      for (const [
        index,
        [enrollmentIndex, dateOffset, status, notes],
      ] of attendanceDefinitions.entries()) {
        const id = uuid('8', index + 1);
        const data = {
          enrollmentId: uuid('7', enrollmentIndex + 1),
          attendanceDate: addDays(today, dateOffset),
          status,
          notes,
        };
        const occupiedAttendance = await tx.studentAttendance.findUnique({
          where: {
            enrollmentId_attendanceDate: {
              enrollmentId: data.enrollmentId,
              attendanceDate: data.attendanceDate,
            },
          },
          select: { id: true },
        });
        if (occupiedAttendance && occupiedAttendance.id !== id) continue;
        await tx.studentAttendance.upsert({ where: { id }, create: { id, ...data }, update: data });
      }

      return {
        admins: adminDefinitions.length,
        students: students.length,
        teachers: teachers.length,
        danceTypes: danceTypes.length,
        branches: branchDefinitions.length,
        rooms: roomDefinitions.length,
        classes: classDefinitions.length,
        schedules: scheduleDefinitions.length,
        enrollments: enrollmentDefinitions.length,
        tariffs: tariffDefinitions.length,
        monthlyCharges: chargeEnrollmentIndexes.length + 1,
        attendances: attendanceDefinitions.length,
        payments: paymentDefinitions.length,
      };
    },
    { maxWait: 10_000, timeout: 30_000 },
  );

  const managedEnrollmentIds = Array.from({ length: 25 }, (_, index) => uuid('7', index + 1));
  const managedChargeIds = Array.from({ length: 13 }, (_, index) => uuid('a', index + 1));
  const managedAttendanceIds = Array.from({ length: 8 }, (_, index) => uuid('8', index + 1));
  const [ana, bruno, carla, diego] = await Promise.all(
    ['30100001', '30100002', '30100003', '30100004'].map((dni) =>
      prisma.student.findUniqueOrThrow({
        where: { dni },
        include: {
          enrollments: {
            where: { id: { in: managedEnrollmentIds } },
            include: {
              monthlyCharges: { where: { id: { in: managedChargeIds } } },
              attendances: { where: { id: { in: managedAttendanceIds } } },
            },
          },
        },
      }),
    ),
  );
  const todayKey = today.toISOString().slice(0, 10);
  const hasTodayAttendance = (student: typeof ana) =>
    student.enrollments.some((enrollment) =>
      enrollment.attendances.some(
        (attendance) => attendance.attendanceDate.toISOString().slice(0, 10) === todayKey,
      ),
    );
  if (
    ana.enrollments.length !== 1 ||
    ana.enrollments[0]!.monthlyCharges.length < 1 ||
    hasTodayAttendance(ana) ||
    bruno.enrollments.length !== 2 ||
    !hasTodayAttendance(bruno) ||
    !carla.enrollments.some((enrollment) => enrollment.status === EnrollmentStatus.ENDED) ||
    diego.enrollments.length !== 0
  ) {
    throw new Error('La verificación de escenarios QA del seed falló.');
  }

  return summary;
};
