// Lint compartido del monorepo (ESLint 9, flat config).
import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/next-env.d.ts',
      'packages/database/prisma/migrations/**',
      // Scripts puntuales de migración de datos históricos: fuera del lint del producto.
      'scripts/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
  {
    files: ['apps/admin-web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { '@next/next': nextPlugin, 'react-hooks': reactHooks },
    settings: { next: { rootDir: 'apps/admin-web' } },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    // Los tests renderizan primitivas con <a> sin router de Next.
    files: ['**/*.spec.{ts,tsx}'],
    rules: { '@next/next/no-html-link-for-pages': 'off' },
  },
  {
    files: ['**/*.{js,cjs}'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
