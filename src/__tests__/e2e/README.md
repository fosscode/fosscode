# End-to-End Testing Framework

This directory contains end-to-end (E2E) tests for the fosscode CLI application using a Mock LLM provider.

## Overview

The E2E testing framework allows testing the complete CLI application flow without depending on external LLM APIs. It uses:

- **MockProvider**: A mock LLM provider that returns predefined responses based on regex patterns
- **E2ETestHelper**: A utility class to simplify E2E test setup and execution
- **execa**: For executing CLI commands as child processes

## Running E2E Tests

```bash
# Run all unit tests (excluding E2E)
bun test

# Run only E2E tests
bun run test:e2e

# Run all tests (unit + E2E)
bun run test:all
```

## Test Structure

### Files

- `helpers.ts` - E2E test helper utilities
- `cli.test.ts` - Basic CLI command tests
- `tools.test.ts` - Tool integration tests
- `README.md` - This documentation

### Example Test

```typescript
import { E2ETestHelper } from './helpers.js';

describe('My E2E Test', () => {
  beforeAll(async () => {
    await E2ETestHelper.buildProject();
  });

  beforeEach(() => {
    E2ETestHelper.clearMockResponses();
  });

  it('should handle chat commands', async () => {
    // Setup mock response
    E2ETestHelper.setupMockResponse(/hello/i, 'Hello from mock!');

    // Run CLI command
    const { stdout, exitCode } = await E2ETestHelper.runChatCommand('hello');

    // Assert results
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Hello from mock!');
  });
});
```

## MockProvider Usage

The MockProvider responds to prompts based on regex patterns:

```typescript
// Setup a response for prompts matching /hello/i
E2ETestHelper.setupMockResponse(/hello/i, 'Hello there!');

// Clear all mock responses
E2ETestHelper.clearMockResponses();
```

## Helper Methods

The E2ETestHelper provides convenient methods:

- `buildProject()` - Build the CLI application
- `setupMockResponse(regex, response)` - Configure mock responses
- `clearMockResponses()` - Clear all mock responses
- `runChatCommand(message)` - Execute a chat command
- `runModelsCommand(provider)` - List models for a provider
- `runProvidersCommand()` - List available providers
- `runCliCommand(args)` - Execute any CLI command

## Environment

E2E tests automatically set:

- `FOSSCODE_PROVIDER=mock` - Use the mock provider
- `NODE_ENV=test` - Test environment mode

## Adding New E2E Tests

1. Create a new test file in `src/__tests__/e2e/`
2. Import `E2ETestHelper`
3. Use the helper methods to setup and execute tests
4. Always clean up mock responses in `beforeEach`/`afterEach`
