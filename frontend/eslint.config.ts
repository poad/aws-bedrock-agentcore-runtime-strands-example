import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  defineConfig,
  globalIgnores,
} from 'eslint/config';

import globals from 'globals';

import {
  fixupConfigRules,
} from '@eslint/compat';

import { parser as tsParser, configs } from 'typescript-eslint';
import reactRefresh from 'eslint-plugin-react-refresh';
import js from '@eslint/js';

import {
  FlatCompat,
} from '@eslint/eslintrc';
import stylistic from '@stylistic/eslint-plugin';
import { importX, createNodeResolver } from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parser: tsParser,
    },

    extends: [
      js.configs.recommended,
      configs.strict,
      configs.stylistic,
      ...fixupConfigRules(compat.extends(
        'plugin:react-hooks/recommended',
      ))],

    plugins: {
      '@stylistic': stylistic,
      'react-refresh': reactRefresh,
    },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
        }),
        createNodeResolver(),
      ],
    },

    rules: {
      'react-refresh/only-export-components': ['warn', {
        allowConstantExport: true,
      }],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/indent': ['error', 2],
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/arrow-parens': ['error', 'always'],
      '@stylistic/quotes': ['error', 'single'],

      'import-x/order': [
        'error',
        {
          'groups': [
            // Imports of builtins are first
            'builtin',
            // Then sibling and parent imports. They can be mingled together
            ['sibling', 'parent'],
            // Then index file imports
            'index',
            // Then any arcane TypeScript imports
            'object',
            // Then the omitted imports: internal, external, type, unknown
          ],
        },
      ],
    },
  }, globalIgnores(['**/dist'])]);
