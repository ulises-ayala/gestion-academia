'use client';

import type { StudentDto } from '@academy/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StudentForm } from '../../../components/student-form';

export default function NewStudentPage() {
  const router = useRouter();
  return (
    <>
      <div className="page-heading">
        <div>
          <Link className="back-link" href="/students">
            ← Volver al listado
          </Link>
          <h1>Nuevo alumno</h1>
          <p className="subtitle">
            Completá los datos personales. La fecha de nacimiento es opcional.
          </p>
        </div>
      </div>
      <section className="card">
        <StudentForm onSaved={(student: StudentDto) => router.push(`/students/${student.id}`)} />
      </section>
    </>
  );
}
