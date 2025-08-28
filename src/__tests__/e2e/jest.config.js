export default {
  preset: 'ts-jest',
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
  // CLI Testing Library setup
  testEnvironmentOptions: {
    // Add any CLI Testing Library specific options here
  },
};
