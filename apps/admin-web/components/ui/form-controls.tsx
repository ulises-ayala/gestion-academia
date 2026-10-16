import React, { type ComponentPropsWithRef, type ReactNode } from 'react';

type FieldProps = {
  /** Stable, unique id, also used to associate the label and descriptions. */
  id: string;
  label: ReactNode;
  helpText?: string | undefined;
  error?: string | undefined;
};

function Field({ id, label, helpText, error, children }: FieldProps & { children: ReactNode }) {
  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {helpText && (
        <span id={`${id}-help`} className="ui-field-help">
          {helpText}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="field-error">
          {error}
        </span>
      )}
    </div>
  );
}

function descriptions(field: FieldProps, external?: string) {
  return (
    [external, field.helpText && `${field.id}-help`, field.error && `${field.id}-error`]
      .filter(Boolean)
      .join(' ') || undefined
  );
}

export function Input({
  label,
  helpText,
  error,
  id,
  ...props
}: ComponentPropsWithRef<'input'> & FieldProps) {
  const field = { label, helpText, error, id };
  return (
    <Field {...field}>
      <input
        {...props}
        id={id}
        aria-describedby={descriptions(field, props['aria-describedby'])}
        aria-invalid={error ? true : props['aria-invalid']}
      />
    </Field>
  );
}

export function Select({
  label,
  helpText,
  error,
  id,
  children,
  ...props
}: ComponentPropsWithRef<'select'> & FieldProps) {
  const field = { label, helpText, error, id };
  return (
    <Field {...field}>
      <select
        {...props}
        id={id}
        aria-describedby={descriptions(field, props['aria-describedby'])}
        aria-invalid={error ? true : props['aria-invalid']}
      >
        {children}
      </select>
    </Field>
  );
}

export function Textarea({
  label,
  helpText,
  error,
  id,
  ...props
}: ComponentPropsWithRef<'textarea'> & FieldProps) {
  const field = { label, helpText, error, id };
  return (
    <Field {...field}>
      <textarea
        {...props}
        id={id}
        aria-describedby={descriptions(field, props['aria-describedby'])}
        aria-invalid={error ? true : props['aria-invalid']}
      />
    </Field>
  );
}
