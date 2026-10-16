'use client';

import { useEffect, useState } from 'react';

export function GlobalLoadingIndicator() {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    function handleLoading(e: Event) {
      const customEvent = e as CustomEvent<boolean>;
      setIsLoading(customEvent.detail);
    }

    window.addEventListener('academy:loading', handleLoading);
    return () => window.removeEventListener('academy:loading', handleLoading);
  }, []);

  if (!isLoading) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.25rem',
        left: '1.25rem',
        zIndex: 9999,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.65rem',
        padding: '0.5rem 0.85rem',
        background: 'rgba(23, 15, 23, 0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(235, 34, 88, 0.35)',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.45)',
        color: '#f3f4f6',
        fontSize: '0.85rem',
        fontWeight: 500,
        pointerEvents: 'none',
        animation: 'fadeIn 0.2s ease-in-out',
      }}
    >
      {/* Spinner animado con el acento de la app */}
      <span
        style={{
          width: '14px',
          height: '14px',
          border: '2px solid rgba(255, 255, 255, 0.15)',
          borderTopColor: '#eb2258',
          borderRadius: '50%',
          display: 'inline-block',
          animation: 'spin 0.75s linear infinite',
        }}
      />
      <span>Sincronizando…</span>

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
