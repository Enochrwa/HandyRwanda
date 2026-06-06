import { FlatCompat } from '@eslint/eslintrc';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  ...compat.extends('universe/native'),
  {
    ignores: ['**/node_modules/**', '**/.expo/**', '**/dist/**', '**/*.d.ts'],
  },
  {
    languageOptions: {
      globals: {
        __dirname: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks/rules-of-hooks': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-unused-expressions': 'off',
      'node/handle-callback-err': 'off',
    },
  },
];
