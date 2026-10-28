import { defineConfig } from 'vitest/config';

// Los tests de integración comparten una base y usan transacciones serializables: en paralelo,
// PostgreSQL aborta transacciones que no se pisan y los reintentos se agotan al azar. Corren
// después de los unitarios y de a un archivo por vez.
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts'],
          exclude: ['src/**/*.integration.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['src/**/*.integration.spec.ts'],
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
