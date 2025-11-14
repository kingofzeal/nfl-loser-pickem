import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

// Cloudflare Workers + Node globals we rely on in runtime code
const workerGlobals = {
  fetch: 'readonly',
  Request: 'readonly',
  Response: 'readonly',
  URL: 'readonly',
  TextEncoder: 'readonly',
  crypto: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  Buffer: 'readonly', // used in RenderService
  process: 'readonly', // env access in config
  ExecutionContext: 'readonly',
  ScheduledEvent: 'readonly'
};

export default [
  eslint.configs.recommended,
  {
    files: ['src/**/*.ts','tests/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: './tsconfig.json' },
      globals: workerGlobals
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      // Turn off no-undef for TypeScript (TS handles this)
      'no-undef': 'off',
      // Use the TypeScript variant only (base rule incorrectly flags parameter properties & interfaces)
      'no-unused-vars': 'off',
      // Allow underscore-prefixed unused params for interface placeholders
      '@typescript-eslint/no-unused-vars': ['warn',{ argsIgnorePattern: '^_' }],
      'no-console': 'off'
    }
  },
  // Disable unused vars checking in pure type/interface definition files – implementation will enforce usage
  {
    files: [
      'src/services/interfaces/**/*.ts',
      'src/commands/interfaces/**/*.ts'
    ],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    }
  }
];
