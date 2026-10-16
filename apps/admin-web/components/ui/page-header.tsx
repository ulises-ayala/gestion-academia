import React, { type ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
}: Readonly<{ title: ReactNode; description?: ReactNode; actions?: ReactNode }>) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
