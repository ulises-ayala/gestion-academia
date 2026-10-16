import React, { type ComponentPropsWithRef } from 'react';

type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'default' | 'small';
  loading?: boolean;
};

const variantClass = {
  primary: '',
  secondary: 'secondary',
  ghost: 'ui-button-ghost',
  destructive: 'danger-button',
};

/** Native button: callers keep their labels, handlers and explicit submit intent. */
export function Button({
  variant = 'primary',
  size = 'default',
  loading = false,
  disabled,
  type = 'button',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`button ui-button ${variantClass[variant]} ${size === 'small' ? 'ui-button-small' : ''} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || props['aria-busy']}
    >
      {children}
    </button>
  );
}
