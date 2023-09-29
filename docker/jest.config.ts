export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  silent: true,

  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  testPathIgnorePatterns: ['<rootDir>/node_modules/', '../../node_modules'],

  transformIgnorePatterns: ['node_modules/(?!@patternfly/react-icons/dist/esm/icons)/'],

  coveragePathIgnorePatterns: ['node_modules/'],
}
