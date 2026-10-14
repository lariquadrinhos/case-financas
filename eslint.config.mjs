import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) })

const config = [
  {
    ignores: [
      '.next/**',
      'next-env.d.ts', // gerado pelo Next a cada build; não é nosso código
      'node_modules/**',
      'coverage/**',
      'storybook-static/**',
      'playwright-report/**',
      'test-results/**',
      'docs/**',
      'files_design/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // ADR-0009 §3: nada de log solto — dado financeiro nunca vai para o console.
      'no-console': ['error', { allow: ['error'] }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // O domínio é puro: não pode importar React, Next nem nada de infraestrutura.
    // O caminho é `src/domain/**` (inglês, ADR-0010) — enquanto apontou para
    // `src/dominio/**`, que não existe, a regra não cobria arquivo nenhum.
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'next', 'next/*'],
              message: 'src/domain é puro: sem framework (ADR-0007 §3).',
            },
            {
              group: ['drizzle-orm', 'drizzle-orm/*', 'better-sqlite3', 'zod', 'zod/*'],
              message:
                'src/domain é puro: persistência e validação de borda ficam fora (ADR-0007 §3).',
            },
            {
              group: [
                '@/data/*',
                '@/api/*',
                '@/features/*',
                '@/app/*',
                '@/components/*',
                '@/server/*',
                '@/lib/*',
              ],
              message:
                'A dependência aponta para dentro: o domínio não conhece as camadas de fora (ADR-0007 §3).',
            },
          ],
        },
      ],
    },
  },
  {
    // A camada de dados conhece o domínio e mais nada de dentro para fora.
    files: ['src/data/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/api/*', '@/features/*', '@/app/*', '@/components/*'],
              message: 'src/data só depende de @/domain (docs/ARCHITECTURE.md §3).',
            },
          ],
        },
      ],
    },
  },
  {
    // Um handler depende do TIPO da porta, nunca do adaptador concreto.
    files: ['src/app/**/*.ts', 'src/app/**/*.tsx', 'src/api/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/data/sqlite', '@/data/sqlite/*', '@/data/pluggy', '@/data/pluggy/*'],
              message:
                'Importe as portas por @/data (composition root), nunca o adaptador (inversão de dependência).',
            },
          ],
        },
      ],
    },
  },
]

export default config
