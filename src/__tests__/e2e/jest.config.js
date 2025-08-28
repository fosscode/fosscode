export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.e2e.test.ts'],
  testTimeout: 60000,
  setupFilesAfterEnv: ['<rootDir>/../../__tests__/setup.ts'],
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
