import React, { type ComponentPropsWithRef, type ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'destructive' | 'info';
const toneClass: Record<Tone, string> = {
  neutral: 'inactive',
  success: 'active',
  warning: 'ui-badge-warning',
  destructive: 'void',
  info: 'ui-badge-info',
};

/** Callers supply the existing translated state; color is never the only signal. */
export function Badge({
  tone = 'neutral',
  className = '',
  children,
  ...props
}: ComponentPropsWithRef<'span'> & { tone?: Tone }) {
  return (
    <span {...props} className={`status ${toneClass[tone]} ${className}`.trim()}>
      {children}
    </span>
  );
}

export function Panel({ className = '', ...props }: ComponentPropsWithRef<'section'>) {
  return <section {...props} className={`card ui-panel ${className}`.trim()} />;
}

export function EmptyState({
  className = '',
  icon,
  children,
  ...props
}: ComponentPropsWithRef<'div'> & { icon?: ReactNode }) {
  return (
    <div {...props} className={`empty-state ui-empty-state ${className}`.trim()}>
      {icon && (
        <span aria-hidden="true" className="ui-empty-state-icon">
          {icon}
        </span>
      )}
      {children}
    </div>
  );
}

/** Decorative placeholder. Put the existing loading message on its parent region. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`ui-skeleton ${className}`.trim()} />;
}
