import React, { type HTMLAttributes, type ReactNode } from 'react';

export type PageWidth = 'wide' | 'default' | 'narrow';

/** Keeps a screen's header and content on the same centered reading grid. */
export function PageContainer({
  width = 'default',
  className = '',
  children,
  ...props
}: Readonly<
  HTMLAttributes<HTMLDivElement> & { width?: PageWidth; className?: string; children: ReactNode }
>) {
  return (
    <div {...props} className={`page-container page-container--${width} ${className}`.trim()}>
      {children}
    </div>
  );
}
