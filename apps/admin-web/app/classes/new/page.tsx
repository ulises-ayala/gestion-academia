'use client';
import type { ClassDto } from '@academy/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClassForm } from '../../../components/class-form';
import { RequirePermission } from '../../../components/permission-gate';
export default function Page() {
  const router = useRouter();
  return (
    <RequirePermission permission="offering:manage">
      <Link className="back-link" href="/classes">
        ← Volver
      </Link>
      <h1>Nueva clase</h1>
      <section className="card">
        <ClassForm onSaved={(item: ClassDto) => router.push(`/classes/${item.id}`)} />
      </section>
    </RequirePermission>
  );
}
