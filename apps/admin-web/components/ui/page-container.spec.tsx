import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PageContainer } from './page-container';

describe('PageContainer', () => {
  it.each(['wide', 'default', 'narrow'] as const)('marks the %s width variant', (width) => {
    expect(renderToStaticMarkup(<PageContainer width={width}>Contenido</PageContainer>)).toContain(
      `page-container--${width}`,
    );
  });
});
