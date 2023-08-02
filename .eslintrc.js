module.exports = {
  root: true,

  extends: [
    'react-app',
    'react-app/jest',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:testing-library/react',
    'prettier',
  ],

  // parser not required as picked up from eslint-config-react-app

  // plugins not required as picked up from eslint-config-react-app

  rules: {
    semi: ['error', 'never'],
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
    'react/prop-types': 'off',
    'testing-library/no-debugging-utils': [
      'warn',
      {
        utilsToCheckFor: {
          debug: false,
        },
      },
    ],
  },
}
