export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/../../../src/__tests__/e2e'],
  testMatch: ['**/*.e2e.test.ts'],
  testTimeout: 60000,
  setupFilesAfterEnv: ['<rootDir>/../../../src/__tests__/setup.ts'],
  verbose: true,
  collectCoverage: false,
  maxWorkers: 1, // Run tests sequentially to avoid port conflicts
  forceExit: true,
  detectOpenHandles: true,
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(strip-final-newline|strip-ansi|ansi-regex|ansi-styles|supports-color)/)',
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
  // CLI Testing Library setup
  testEnvironmentOptions: {
    // Add any CLI Testing Library specific options here
  },
};
