'use client';

import type { SelfCheckInDto } from '@academy/contracts';
import { BadgeCheck, CheckCircle2, CircleAlert, Info, TriangleAlert } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../lib/api-client';
import {
  SELF_CHECK_IN_DNI_LENGTH,
  SELF_CHECK_IN_TYPING_TIMEOUT_MS,
  checkInFailureMessage,
  checkInMessage,
  idleCapture,
  reduceCaptureKey,
  type CaptureState,
  type CheckInMessage,
} from '../lib/self-check-in';

type Phase =
  | Readonly<{ kind: 'idle' }>
  | Readonly<{ kind: 'typing'; digits: string }>
  | Readonly<{ kind: 'sending' }>
  | Readonly<{ kind: 'result'; message: CheckInMessage }>;

const toneIcon = { success: CheckCircle2, info: Info, warning: CircleAlert } as const;

/**
 * Autoregistro de asistencia: en cualquier pantalla, "#" seguido del DNI (8 dígitos)
 * marca el presente y muestra un aviso que se cierra solo.
 */
export function SelfCheckIn() {
  const captureRef = useRef<CaptureState>(idleCapture);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };
  const closeAfter = useCallback((ms: number) => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      captureRef.current = idleCapture;
      setPhase({ kind: 'idle' });
    }, ms);
  }, []);

  const submit = useCallback(
    async (dni: string) => {
      clearTimer();
      setPhase({ kind: 'sending' });
      let message: CheckInMessage;
      try {
        message = checkInMessage(
          await apiRequest<SelfCheckInDto>('/attendances/self-check-in', {
            method: 'POST',
            body: JSON.stringify({ dni }),
          }),
        );
      } catch {
        message = checkInFailureMessage;
      }
      if (captureRef.current.active) return;
      setPhase({ kind: 'result', message });
      closeAfter(message.durationMs);
    },
    [closeAfter],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) return;
      const { state, action } = reduceCaptureKey(captureRef.current, event.key);
      if (action === 'ignore') return;
      event.preventDefault();
      event.stopPropagation();
      captureRef.current = state;
      if (action === 'cancel') {
        clearTimer();
        setPhase({ kind: 'idle' });
        return;
      }
      if (action === 'submit') {
        void submit(state.digits);
        return;
      }
      setPhase({ kind: 'typing', digits: state.digits });
      closeAfter(SELF_CHECK_IN_TYPING_TIMEOUT_MS);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      clearTimer();
    };
  }, [closeAfter, submit]);

  if (phase.kind === 'idle') return null;

  const message = phase.kind === 'result' ? phase.message : null;
  const Icon = message ? toneIcon[message.tone] : null;
  return (
    <div className="self-check-in-backdrop">
      <div
        aria-live="assertive"
        className={`self-check-in ${message ? `is-${message.tone}` : ''}`}
        role="status"
      >
        {phase.kind === 'typing' && (
          <>
            <p className="self-check-in-eyebrow">Registro de asistencia</p>
            <p className="self-check-in-title">Ingresá tu DNI</p>
            <div aria-hidden="true" className="self-check-in-slots">
              {Array.from({ length: SELF_CHECK_IN_DNI_LENGTH }, (_, index) => (
                <span className={index < phase.digits.length ? 'is-filled' : ''} key={index} />
              ))}
            </div>
            <p className="self-check-in-hint">
              {phase.digits.length} de {SELF_CHECK_IN_DNI_LENGTH} dígitos · Si tu DNI tiene 7,
              empezá con 0
            </p>
          </>
        )}
        {phase.kind === 'sending' && <p className="self-check-in-title">Registrando…</p>}
        {message && Icon && (
          <>
            <Icon aria-hidden="true" className="self-check-in-icon" size={64} strokeWidth={1.6} />
            <p className="self-check-in-title">{message.title}</p>
            {message.detail && <p className="self-check-in-detail">{message.detail}</p>}
            {message.location && <p className="self-check-in-location">{message.location}</p>}
            {message.payment && (
              <p className={`self-check-in-payment is-${message.payment.tone}`}>
                {message.payment.tone === 'ok' ? (
                  <BadgeCheck aria-hidden="true" size={22} strokeWidth={1.8} />
                ) : (
                  <TriangleAlert aria-hidden="true" size={22} strokeWidth={1.8} />
                )}
                {message.payment.text}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
