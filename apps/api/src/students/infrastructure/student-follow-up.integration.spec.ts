import { PrismaClient, type AttendanceStatus } from '@academy/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { PrismaEnrollmentRepository } from '../../enrollments/infrastructure/prisma-enrollment.repository';
import { EnrollmentsService } from '../../enrollments/application/enrollments.service';
import { PrismaStudentFollowUpReader } from './prisma-student-follow-up.reader';
import { followUpCountQuery } from './student-follow-up-query';

// Explicit opt-in; never load a developer's .env or run fixtures on the academy database.
const enabled = Boolean(
  process.env.DATABASE_URL &&
    /(?:academy_ci|follow_up_test)(?:\?|$)/.test(process.env.DATABASE_URL),
);
describe.runIf(enabled)('Student follow-up PostgreSQL read model and enrollment end', () => {
  const db = new PrismaClient();
  const reader = new PrismaStudentFollowUpReader(db as PrismaService);
  const repository = new PrismaEnrollmentRepository(db as PrismaService);
  const service = new EnrollmentsService(repository);
  const token = crypto.randomUUID();
  let teacherId: string;
  let danceTypeId: string;
  let actorId: string;
  beforeAll(async () => {
    teacherId = (
      await db.teacher.create({
        data: { dni: token.slice(0, 30), firstName: 'Luz', lastName: 'Docente' },
      })
    ).id;
    danceTypeId = (await db.danceType.create({ data: { name: token, normalizedName: token } })).id;
    actorId = (
      await db.adminUser.create({
        data: { username: token, passwordHash: 'test-only', role: 'RECEPTION' },
      })
    ).id;
  });
  afterAll(async () => db.$disconnect());
  async function student() {
    return db.student.create({
      data: {
        firstName: 'Ana',
        lastName: `Pérez ${token}`,
        dni: BigInt(`0x${crypto.randomUUID().replaceAll('-', '')}`)
          .toString()
          .slice(0, 32),
      },
    });
  }
  async function enrollment(statuses: AttendanceStatus[], studentId?: string) {
    const owner = studentId ?? (await student()).id;
    const academicClass = await db.academyClass.create({
      data: { name: `Jazz ${crypto.randomUUID()}`, teacherId, danceTypeId, capacity: 30 },
    });
    const item = await db.enrollment.create({
      data: { studentId: owner, classId: academicClass.id, startDate: new Date('2026-01-01') },
    });
    await db.studentAttendance.createMany({
      data: statuses.map((status, index) => ({
        enrollmentId: item.id,
        status,
        attendanceDate: new Date(Date.UTC(2026, 8, index * 2 + 1)),
      })),
    });
    return item;
  }
  const query = { q: token, minAbsences: 3, page: 1, pageSize: 100 };
  it.each([
    [['ABSENT', 'ABSENT', 'ABSENT'], 3, null],
    [['ABSENT', 'ABSENT', 'PRESENT', 'ABSENT', 'ABSENT', 'ABSENT'], 3, '2026-09-05'],
    [['ABSENT', 'ABSENT', 'ABSENT', 'PRESENT'], 0, '2026-09-07'],
    [['ABSENT', 'ABSENT', 'JUSTIFIED', 'ABSENT'], 1, null],
    [[], 0, null],
  ] as [AttendanceStatus[], number, string | null][])(
    'uses only actual records %j -> %i',
    async (statuses, absences, present) => {
      const item = await enrollment(statuses);
      const rows = await reader.forStudent(item.studentId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        consecutiveAbsences: absences,
        lastPresentAt: present,
        lastAttendanceStatus: statuses.at(-1) ?? null,
        lastAttendanceRecordAt: statuses.length
          ? new Date(Date.UTC(2026, 8, (statuses.length - 1) * 2 + 1)).toISOString().slice(0, 10)
          : null,
      });
      const list = await reader.list({ ...query, classId: item.classId });
      expect(list.total).toBe(absences >= 3 ? 1 : 0);
    },
  );
  it('keeps separate enrollment/class streaks', async () => {
    const first = await enrollment(['ABSENT', 'ABSENT', 'ABSENT']);
    const second = await enrollment(['PRESENT'], first.studentId);
    const rows = await reader.forStudent(first.studentId);
    expect(rows.find((r) => r.enrollmentId === first.id)?.consecutiveAbsences).toBe(3);
    expect(rows.find((r) => r.enrollmentId === second.id)?.consecutiveAbsences).toBe(0);
  });
  it('counts one student with two cases and supports filters/pagination', async () => {
    const before = await db.$queryRaw<{ students: bigint }[]>(followUpCountQuery());
    const first = await enrollment(['ABSENT', 'ABSENT', 'ABSENT']);
    await enrollment(['ABSENT', 'ABSENT', 'ABSENT', 'ABSENT'], first.studentId);
    const after = await db.$queryRaw<{ students: bigint }[]>(followUpCountQuery());
    expect(Number(after[0]!.students) - Number(before[0]!.students)).toBe(1);
    const owner = await db.student.findUniqueOrThrow({ where: { id: first.studentId } });
    const result = await reader.list({ ...query, q: owner.dni, pageSize: 1 });
    expect(result).toMatchObject({ total: 2, students: 1, page: 1, pageSize: 1 });
    expect(result.items[0]?.consecutiveAbsences).toBe(4);
    const secondPage = await reader.list({ ...query, q: owner.dni, pageSize: 1, page: 2 });
    expect(secondPage.items[0]?.consecutiveAbsences).toBe(3);
    expect((await reader.list({ ...query, q: owner.dni, minAbsences: 4 })).total).toBe(1);
    expect((await reader.list({ ...query, q: owner.dni, minAbsences: 5 })).total).toBe(0);
    expect(
      (await reader.list({ ...query, q: `Ana Pérez ${token}`, classId: first.classId })).total,
    ).toBe(1);
    expect((await reader.list({ ...query, q: 'Pérez Ana', classId: first.classId })).total).toBe(1);
    const empty = await reader.list({ ...query, q: 'not-a-student' });
    expect(empty.total).toBe(0);
    expect(empty.globalTotal).toBeGreaterThan(0);
    expect((await reader.list({ ...query, q: owner.dni, page: 100 })).items).toEqual([]);
  });
  it('ends atomically with reason, actor and unchanged attendance/student; exits follow-up', async () => {
    const item = await enrollment(['ABSENT', 'ABSENT', 'ABSENT']);
    const updated = await service.end(
      item.id,
      { endDate: '2026-10-01', endReason: 'PERSONAL_REASONS', endNote: ' Viaje ' },
      actorId,
    );
    expect(updated).toMatchObject({
      status: 'ENDED',
      endDate: '2026-10-01',
      endReason: 'PERSONAL_REASONS',
      endNote: 'Viaje',
    });
    expect((await reader.list({ ...query, classId: item.classId })).items).toEqual([]);
    expect(await db.studentAttendance.count({ where: { enrollmentId: item.id } })).toBe(3);
    expect((await db.student.findUniqueOrThrow({ where: { id: item.studentId } })).status).toBe(
      'ACTIVE',
    );
    const logs = await db.auditLog.findMany({ where: { entityId: item.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      action: 'END',
      actorUserId: actorId,
      after: { endReason: 'PERSONAL_REASONS', endNote: 'Viaje', endDate: '2026-10-01' },
      metadata: { studentId: item.studentId, classId: item.classId },
    });
  });
  it('rejects OTHER without note and accepts it with note', async () => {
    const item = await enrollment([]);
    await expect(
      service.end(item.id, { endDate: '2026-10-01', endReason: 'OTHER' }, actorId),
    ).rejects.toMatchObject({ code: 'ENROLLMENT_END_NOTE_REQUIRED' });
    expect(await db.auditLog.count({ where: { entityId: item.id } })).toBe(0);
    await expect(
      service.end(
        item.id,
        { endDate: '2026-10-01', endReason: 'OTHER', endNote: 'Otra actividad' },
        actorId,
      ),
    ).resolves.toMatchObject({ endNote: 'Otra actividad' });
  });
  it('serializes two concurrent ends: one change and one audit', async () => {
    const item = await enrollment([]);
    const results = await Promise.allSettled([
      service.end(item.id, { endDate: '2026-10-01', endReason: 'SCHEDULE_CHANGE' }, actorId),
      service.end(item.id, { endDate: '2026-10-02', endReason: 'DISCIPLINE_CHANGE' }, actorId),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({
      reason: { code: 'ENROLLMENT_ALREADY_ENDED' },
    });
    expect(await db.auditLog.count({ where: { entityId: item.id } })).toBe(1);
  });
  it('preserves legacy reason null and isolates a later enrollment in the same class', async () => {
    const item = await enrollment(['ABSENT', 'ABSENT', 'ABSENT']);
    await db.enrollment.update({
      where: { id: item.id },
      data: { status: 'ENDED', endDate: new Date('2026-09-10') },
    });
    expect(await repository.findById(item.id)).toMatchObject({
      endDate: '2026-09-10',
      endReason: null,
      endNote: null,
    });
    await db.enrollment.create({
      data: { classId: item.classId, studentId: item.studentId, startDate: new Date('2026-10-01') },
    });
    const rows = await reader.forStudent(item.studentId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.consecutiveAbsences).toBe(0);
  });
  it('rolls back end if the audit cannot be persisted', async () => {
    const item = await enrollment([]);
    await expect(
      service.end(
        item.id,
        { endDate: '2026-10-01', endReason: 'PERSONAL_REASONS' },
        crypto.randomUUID(),
      ),
    ).rejects.toBeDefined();
    expect(await repository.findById(item.id)).toMatchObject({
      status: 'ACTIVE',
      endDate: null,
      endReason: null,
    });
  });
});
