'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { StudentOnboarding } from '../../../components/student-onboarding';

/** El alta también como página, para los enlaces directos (`?leadId=` o `?modo=prueba`). */
function NewStudent() {
  const search = useSearchParams();
  return (
    <StudentOnboarding
      initialLeadId={search.get('leadId')}
      initialMode={search.get('modo') === 'prueba' ? 'trial' : 'enroll'}
      variant="page"
    />
  );
}

export default function NewStudentPage() {
  return (
    <Suspense fallback={null}>
      <NewStudent />
    </Suspense>
  );
}
