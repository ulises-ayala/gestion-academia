import React, { type ComponentPropsWithRef, type ReactNode } from 'react';

export function Tabs({ className = '', ...props }: ComponentPropsWithRef<'nav'>) {
  return <nav {...props} className={`ui-tabs ${className}`.trim()} />;
}

export function FilterToolbar({ className = '', ...props }: ComponentPropsWithRef<'form'>) {
  return <form {...props} className={`ui-filter-toolbar ${className}`.trim()} />;
}

export function Table({
  className = '',
  children,
}: Readonly<{ className?: string; children: ReactNode }>) {
  return (
    <div className={`ui-table-wrap ${className}`.trim()}>
      <table className="ui-table">{children}</table>
    </div>
  );
}

export function Pagination({ className = '', ...props }: ComponentPropsWithRef<'nav'>) {
  return <nav {...props} className={`ui-pagination ${className}`.trim()} />;
}
