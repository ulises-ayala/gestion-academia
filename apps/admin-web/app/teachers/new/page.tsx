'use client';
import type { TeacherDto } from '@academy/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TeacherForm } from '../../../components/teacher-form';
export default function Page() {
  const router = useRouter();
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
        <TeacherForm onSaved={(teacher: TeacherDto) => router.push(`/teachers/${teacher.id}`)} />
      </section>
    </>
  );
}
