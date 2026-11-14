'use client';

import React, { useEffect, useRef, useState } from 'react';
import { type OnboardingMode, StudentOnboarding } from './student-onboarding';

/**
 * Popup de alta: inscribir un alumno nuevo o registrar una clase de prueba, sin salir de la
 * pantalla. `onClose(changed)` avisa si se creó algo, para refrescar lo que se estaba viendo.
 */
export function NewStudentDialog({
  leadId = null,
  initialMode = 'enroll',
  onClose,
}: Readonly<{
  leadId?: string | null;
  initialMode?: OnboardingMode;
  onClose(changed: boolean): void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      opener?.focus();
    };
  }, []);
  return (
    <dialog
      aria-labelledby="student-onboarding-title"
      className="modal card student-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose(changed);
      }}
      ref={dialog}
    >
      <StudentOnboarding
        initialLeadId={leadId}
        initialMode={initialMode}
        onChanged={() => setChanged(true)}
        onClose={() => onClose(changed)}
        variant="dialog"
      />
    </dialog>
  );
}
