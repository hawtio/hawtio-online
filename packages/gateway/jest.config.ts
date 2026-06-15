import path from 'path'

export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  silent: false,

  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  moduleNameMapper: {},

  // The path to a module that runs some code to configure or set up the testing
  // framework before each test
  // setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],

  testPathIgnorePatterns: ['<rootDir>/node_modules/'],

  transformIgnorePatterns: ['node_modules/(?!yaml)/*'],

  coveragePathIgnorePatterns: ['node_modules/'],

  setupFiles: ['<rootDir>/.jestEnvVars.js'],
}
