'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LeadForm } from '../../../components/lead-form';
import { notifySuccess } from '../../../lib/notify';

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
        <LeadForm
          onSaved={(lead) => {
            notifySuccess('Potencial registrado', `${lead.name} guardado en estado ${lead.status}`);
            router.push(`/leads/${lead.id}`);
          }}
        />
      </section>
    </>
  );
}
