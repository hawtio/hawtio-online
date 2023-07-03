import path from 'path'

export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  silent: true,

  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  // Mocks necessary for dealing with jest issues, eg.
  // "SyntaxError: Cannot use import statement outside a module"
  // can happen if the react-code-editor entry here is removed.
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga|md)$':
      '<rootDir>/src/__mocks__/fileMock.js',
    '\\.(css|less)$': '<rootDir>/src/__mocks__/styleMock.js',
    'react-markdown': '<rootDir>/../../node_modules/react-markdown/react-markdown.min.js',
    '@patternfly/react-code-editor': path.resolve(__dirname, './src/__mocks__/codeEditorMock.js'),
  },

  // The path to a module that runs some code to configure or set up the testing
  // framework before each test
  //
  // Necessary to avoid the error message "ReferenceError: jQuery is not defined"
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],

  testPathIgnorePatterns: ['<rootDir>/node_modules/', '../../node_modules'],

  transformIgnorePatterns: [
    'node_modules/(?!@patternfly/react-icons/dist/esm/icons)/',
  ],

  coveragePathIgnorePatterns: ['node_modules/'],
}
