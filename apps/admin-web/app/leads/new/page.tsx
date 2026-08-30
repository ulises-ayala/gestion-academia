'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LeadForm } from '../../../components/lead-form';

export default function NewLeadPage() {
  const router = useRouter();
  return (
    <>
      <Link className="back-link" href="/leads">
        ← Volver
      </Link>
      <p className="eyebrow">Seguimiento</p>
      <h1>Nuevo potencial</h1>
      <p className="subtitle">Registrá una consulta sin exigir datos propios de un alumno.</p>
      <section className="card">
        <LeadForm onSaved={(lead) => router.push(`/leads/${lead.id}`)} />
      </section>
    </>
  );
}
