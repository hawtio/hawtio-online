export default {
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  coveragePathIgnorePatterns: ['node_modules/'],

  preset: 'ts-jest',
  silent: false,

  roots: ['src', 'integration-tests'],

  testEnvironment: 'node',
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '../../node_modules'],

  transformIgnorePatterns: ['node_modules/(?!@patternfly/react-icons/dist/esm/icons)/'],
}
