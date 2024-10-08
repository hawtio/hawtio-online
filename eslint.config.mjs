import jsPlugin from '@eslint/js'
import tsPlugin from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'
import react from 'eslint-plugin-react'
import configPrettier from 'eslint-config-prettier'

// Plugins still requiring compat library as not yet fully v9 flat-config compliant
import { fixupPluginRules } from '@eslint/compat'
import reactHooks from 'eslint-plugin-react-hooks'
import testingLibrary from 'eslint-plugin-testing-library'

export default [
  {
    ignores: [
      '*.js',
      '*.cjs',
      '*.mjs',
      '**/.jestEnvVars.js',
      '.gitignore',
      '.dockerignore',
      '**/.env.*',
      '**/env.*',
      '**/ignore/**/*',
      '**/__mocks__/*.js',
      '**/testdata/**/*.js',
      '**/jest.config.ts',
      '**/tsup.config*.ts',
      '**/webpack*.js',
      '**/proxy-dev-server.js',
      '**/dist/*',
      '**/build/*',
    ],
  },

  configPrettier,
  jsPlugin.configs.recommended,
  ...tsPlugin.configs.recommended,
  importPlugin.flatConfigs.recommended,

  {
    plugins: {
      // Re-enable when react plugin is working correctly with eslint v9
      // react,
      'react-hooks': fixupPluginRules({
        rules: reactHooks.rules,
      }),
      'testing-library': fixupPluginRules({
        rules: testingLibrary.rules,
      }),
    },

    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      }
    },

    rules: {
      ...testingLibrary.configs['flat/react'].rules,
      ...reactHooks.configs.recommended.rules,

      // Re-enable when react plugin is working correctly with eslint v9
      // 'react/jsx-uses-react': 'error',
      // 'react/jsx-uses-vars': 'error',

      semi: ['error', 'never'],

      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'none',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      '@typescript-eslint/explicit-member-accessibility': [
        'warn',
        {
          accessibility: 'no-public',
        },
      ],

      '@typescript-eslint/no-empty-function': [
        'error',
        {
          allow: ['constructors'],
        },
      ],

      '@typescript-eslint/no-redeclare': 'off',

      'import/no-default-export': 'error',
      'import/no-unresolved': 'off',
      'import/named': 'off',
      'import/first': 'error',

      'react/prop-types': 'off',

      'no-template-curly-in-string': 'error',
      'no-console': 'error',

      'testing-library/await-async-queries': 'off',
      'testing-library/no-debugging-utils': [
        'warn',
        {
          utilsToCheckFor: {
            debug: false,
          },
        },
      ],
    },
  },
]
