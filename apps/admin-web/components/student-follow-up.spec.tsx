import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { StudentFollowUpItemDto } from '@academy/contracts';
import {
  FollowUpDashboardLink,
  FollowUpEmpty,
  FollowUpIndicator,
  FollowUpTable,
} from './student-follow-up';
import { enrollmentEndLabel, enrollmentEndLabels } from '../lib/enrollment-end';

const item: StudentFollowUpItemDto = {
  studentId: 'student',
  studentName: 'Ana Pérez',
  studentDni: '12345678',
  enrollmentId: 'enrollment',
  startDate: '2026-01-01',
  classId: 'class',
  className: 'Jazz',
  teacherName: 'Luz Docente',
  consecutiveAbsences: 3,
  lastPresentAt: null,
  lastAttendanceRecordAt: '2026-09-05',
  lastAttendanceStatus: 'ABSENT',
};
describe('Student follow-up UI and Student 360', () => {
  it('renders the real case and mobile labels without raw enum/ISO', () => {
    const html = renderToStaticMarkup(<FollowUpTable items={[item]} canEnd onEnd={() => {}} />);
    for (const label of [
      'Ana Pérez',
      'Jazz',
      'Luz Docente',
      'Ausente',
      'Sin asistencias registradas como presente',
      'Finalizar inscripción',
      'data-label="Último registro"',
      '/students/student',
    ])
      expect(html).toContain(label);
    expect(html).not.toContain('ABSENT');
    expect(html).not.toContain('2026-09-05');
  });
  it('hides end action without enrollment permission', () => {
    const html = renderToStaticMarkup(
      <FollowUpTable items={[item]} canEnd={false} onEnd={() => {}} />,
    );
    expect(html).toContain('Ver alumno');
    expect(html).not.toContain('Finalizar inscripción');
  });
  it('shows current-class indicator with 3+ absences', () => {
    const html = renderToStaticMarkup(
      <FollowUpIndicator item={{ ...item, lastPresentAt: '2026-09-01' }} />,
    );
    expect(html).toContain('Requiere seguimiento');
    expect(html).toContain('3 ausencias consecutivas');
    expect(html).toContain('1/9/2026');
  });
  it('does not mark a normal enrollment or missing data', () => {
    expect(
      renderToStaticMarkup(<FollowUpIndicator item={{ ...item, consecutiveAbsences: 2 }} />),
    ).toBe('');
    expect(renderToStaticMarkup(<FollowUpIndicator item={undefined} />)).toBe('');
  });
  it('preserves legacy null and presents every end reason in business language', () => {
    expect(enrollmentEndLabel(null)).toBe('Sin motivo registrado');
    expect(enrollmentEndLabel('PERSONAL_REASONS')).toBe('Motivos personales');
    expect(Object.keys(enrollmentEndLabels)).toHaveLength(6);
    for (const [key, label] of Object.entries(enrollmentEndLabels)) expect(label).not.toBe(key);
  });
  it('distinguishes global empty and no filter matches', () => {
    expect(renderToStaticMarkup(<FollowUpEmpty globalTotal={0} />)).toContain('¡Todo al día!');
    expect(renderToStaticMarkup(<FollowUpEmpty globalTotal={2} />)).toContain(
      'No encontramos alumnos con estos filtros.',
    );
  });
  it('links dashboard unique count to follow-up', () => {
    const html = renderToStaticMarkup(<FollowUpDashboardLink students={1} />);
    expect(html).toContain('href="/students/follow-up"');
    expect(html).toContain('<strong>1</strong>');
    expect(html).toContain('Alumnos para seguimiento');
  });
});
