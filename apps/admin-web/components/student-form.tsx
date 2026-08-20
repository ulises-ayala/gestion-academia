'use client';

import type { CreateStudentDto, StudentDto, UpdateStudentDto } from '@academy/contracts';
import { FormEvent, useState } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';

type FormState = { dni: string; firstName: string; lastName: string; birthDate: string; phone: string; email: string; address: string };
const emptyForm: FormState = { dni: '', firstName: '', lastName: '', birthDate: '', phone: '', email: '', address: '' };

export function StudentForm({ student, onSaved, onCancel }: Readonly<{ student?: StudentDto; onSaved(student: StudentDto): void; onCancel?(): void }>) {
  const [form, setForm] = useState<FormState>(student ? { dni: student.dni, firstName: student.firstName, lastName: student.lastName, birthDate: student.birthDate?.slice(0, 10) ?? '', phone: student.phone ?? '', email: student.email ?? '', address: student.address ?? '' } : emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFieldErrors({}); setMessage(''); setSubmitting(true);
    const payload: CreateStudentDto | UpdateStudentDto = form;
    try {
      const saved = await apiRequest<StudentDto>(student ? `/students/${student.id}` : '/students', { method: student ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      onSaved(saved);
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.field) setFieldErrors({ [error.field]: error.message }); else setMessage(error.message);
      } else setMessage('No se pudo conectar con la API');
    } finally { setSubmitting(false); }
  }

  const input = (field: keyof FormState, value: string) => { setForm({ ...form, [field]: value }); setFieldErrors((current) => { const next = { ...current }; delete next[field]; return next; }); };
  const error = (field: keyof FormState) => fieldErrors[field] ? <span className="field-error">{fieldErrors[field]}</span> : null;

  return <form className="student-form" onSubmit={submit} noValidate>
    <label>DNI<input required aria-invalid={Boolean(fieldErrors.dni)} value={form.dni} onChange={(event) => input('dni', event.target.value)} />{error('dni')}</label>
    <label>Nombre<input required aria-invalid={Boolean(fieldErrors.firstName)} value={form.firstName} onChange={(event) => input('firstName', event.target.value)} />{error('firstName')}</label>
    <label>Apellido<input required aria-invalid={Boolean(fieldErrors.lastName)} value={form.lastName} onChange={(event) => input('lastName', event.target.value)} />{error('lastName')}</label>
    <label>Fecha de nacimiento <span className="optional">Opcional</span><input type="date" aria-invalid={Boolean(fieldErrors.birthDate)} value={form.birthDate} onChange={(event) => input('birthDate', event.target.value)} />{error('birthDate')}</label>
    <label>Teléfono <span className="optional">Opcional</span><input aria-invalid={Boolean(fieldErrors.phone)} value={form.phone} onChange={(event) => input('phone', event.target.value)} />{error('phone')}</label>
    <label>Correo <span className="optional">Opcional</span><input type="email" aria-invalid={Boolean(fieldErrors.email)} value={form.email} onChange={(event) => input('email', event.target.value)} />{error('email')}</label>
    <label className="wide">Domicilio <span className="optional">Opcional</span><input aria-invalid={Boolean(fieldErrors.address)} value={form.address} onChange={(event) => input('address', event.target.value)} />{error('address')}</label>
    <div className="actions wide"><button disabled={submitting} type="submit">{submitting ? 'Guardando…' : student ? 'Guardar cambios' : 'Crear alumno'}</button>{onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancelar</button>}</div>
    {message && <p className="message wide" role="alert">{message}</p>}
  </form>;
}
