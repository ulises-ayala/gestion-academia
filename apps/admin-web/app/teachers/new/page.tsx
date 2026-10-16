'use client';
import type { TeacherDto } from '@academy/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TeacherForm } from '../../../components/teacher-form';
import { notifySuccess } from '../../../lib/notify';

export default function Page() {
  const router = useRouter();

  const handleSaved = (teacher: TeacherDto) => {
    notifySuccess(
      'Profesor registrado con éxito',
      `${teacher.firstName} ${teacher.lastName} (DNI ${teacher.dni})`,
    );
    router.push(`/teachers/${teacher.id}`);
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <Link className="back-link" href="/teachers">
            ← Volver
          </Link>
          <h1>Nuevo profesor</h1>
        </div>
      </div>
      <section className="card">
        <TeacherForm onSaved={handleSaved} />
      </section>
    </>
  );
}