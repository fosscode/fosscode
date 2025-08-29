import { execa } from 'execa';
import { MockProvider } from '../../providers/MockProvider';

describe('E2E Chat Command with MockProvider', () => {
  beforeEach(() => {
    // Ensure the mock provider is clean before each test
    MockProvider.clearResponses();
  });

  test('should return a canned response for a specific prompt', async () => {
    const testPrompt = 'Hello, mock!';
    const cannedResponse = 'This is a canned response from MockProvider.';

    MockProvider.addResponse(new RegExp(testPrompt), cannedResponse);

    // Execute the CLI command, forcing it to use the mock provider
    // We need to build the project first to ensure dist/index.js exists
    // For testing, we'll assume 'bun run dist/index.js' works
    const { stdout } = await execa('bun', [
      'run',
      'dist/index.js',
      'chat',
      testPrompt,
    ], {
      env: { FOSSCODE_PROVIDER: 'mock' },
    });

    expect(stdout).toContain(cannedResponse);
  });

  test('should indicate no canned response if prompt does not match', async () => {
    const testPrompt = 'No match here.';
    // No canned response added for this prompt

    const { stdout } = await execa('bun', [
      'run',
      'dist/index.js',
      'chat',
      testPrompt,
    ], {
      env: { FOSSCODE_PROVIDER: 'mock' },
    });

    expect(stdout).toContain(`MockProvider: No canned response for prompt: "${testPrompt}"`);
  });
});
