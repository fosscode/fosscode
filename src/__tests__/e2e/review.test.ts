/**
 * Integration tests for the /review command
 *
 * These tests verify the review command works with real git operations
 * but mock the LLM provider to avoid API calls during testing.
 */

import { ReviewCommand } from '../../commands/ReviewCommand';
import { ProviderManager } from '../../providers/ProviderManager';
import { ConfigManager } from '../../config/ConfigManager';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock the provider manager but not git operations
jest.mock('../../providers/ProviderManager');
jest.mock('../../config/ConfigManager');

describe('Review Command Integration Tests', () => {
  let reviewCommand: ReviewCommand;
  let mockProviderManager: jest.Mocked<ProviderManager>;
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let testDir: string;
  let originalCwd: string;

  beforeAll(() => {
    originalCwd = process.cwd();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-test-'));

    // Setup mock ConfigManager
    mockConfigManager = {
      getConfig: jest.fn().mockReturnValue({
        lastSelectedProvider: 'mock',
        lastSelectedModel: 'mock-model',
      }),
      getProviderConfig: jest.fn().mockReturnValue({}),
    } as unknown as jest.Mocked<ConfigManager>;

    // Setup mock ProviderManager
    mockProviderManager = {
      sendMessage: jest.fn().mockResolvedValue({
        content: '[]',
        finishReason: 'stop',
      }),
      initializeProvider: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ProviderManager>;

    (ConfigManager as jest.Mock).mockImplementation(() => mockConfigManager);
    (ProviderManager as jest.Mock).mockImplementation(() => mockProviderManager);

    // Initialize git repo in test directory
    try {
      execSync('git init', { cwd: testDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: testDir, stdio: 'pipe' });
      execSync('git config user.name "Test User"', { cwd: testDir, stdio: 'pipe' });

      // Create initial commit
      fs.writeFileSync(path.join(testDir, 'README.md'), '# Test Project\n');
      execSync('git add README.md', { cwd: testDir, stdio: 'pipe' });
      execSync('git commit -m "Initial commit"', { cwd: testDir, stdio: 'pipe' });
    } catch (error) {
      console.error('Failed to setup test git repo:', error);
    }

    // Change to test directory
    process.chdir(testDir);

    reviewCommand = new ReviewCommand(mockConfigManager, mockProviderManager);
  });

  afterEach(() => {
    // Return to original directory
    process.chdir(originalCwd);

    // Clean up test directory
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  afterAll(() => {
    process.chdir(originalCwd);
  });

  describe('Review staged changes', () => {
    it('should review staged changes', async () => {
      // Create a new file and stage it
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'export function test() { return 42; }\n');
      execSync('git add test.ts', { cwd: testDir, stdio: 'pipe' });

      const result = await reviewCommand.execute({ staged: true });

      expect(result.success).toBe(true);
      expect(result.reviewedFiles).toContain('test.ts');
      expect(mockProviderManager.sendMessage).toHaveBeenCalled();
    });

    it('should return empty when no staged changes', async () => {
      const result = await reviewCommand.execute({ staged: true });

      expect(result.success).toBe(true);
      expect(result.findings).toHaveLength(0);
      expect(result.summary).toBe('No changes to review.');
    });
  });

  describe('Review specific commit', () => {
    it('should review a specific commit', async () => {
      // Create a new file and commit it
      const testFile = path.join(testDir, 'feature.ts');
      fs.writeFileSync(testFile, 'export const VERSION = "1.0.0";\n');
      execSync('git add feature.ts', { cwd: testDir, stdio: 'pipe' });
      execSync('git commit -m "Add feature"', { cwd: testDir, stdio: 'pipe' });

      // Get the commit SHA
      const commitSha = execSync('git rev-parse HEAD', { cwd: testDir, encoding: 'utf-8' }).trim();

      const result = await reviewCommand.execute({ commit: commitSha });

      expect(result.success).toBe(true);
      expect(result.reviewedFiles).toContain('feature.ts');
    });

    it('should handle invalid commit SHA', async () => {
      const result = await reviewCommand.execute({ commit: 'invalid-sha-12345' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Review against branch', () => {
    it('should review changes against a branch', async () => {
      // Create a feature branch
      execSync('git checkout -b feature-branch', { cwd: testDir, stdio: 'pipe' });

      // Add a new file on the feature branch
      const testFile = path.join(testDir, 'new-feature.ts');
      fs.writeFileSync(testFile, 'export function newFeature() { return true; }\n');
      execSync('git add new-feature.ts', { cwd: testDir, stdio: 'pipe' });
      execSync('git commit -m "Add new feature"', { cwd: testDir, stdio: 'pipe' });

      // Rename main to master for this test (if needed)
      const mainBranch = 'main';
      try {
        execSync(`git rev-parse --verify ${mainBranch}`, { cwd: testDir, stdio: 'pipe' });
      } catch {
        // If main doesn't exist, try master
      }

      const result = await reviewCommand.execute({ baseBranch: mainBranch });

      expect(result.success).toBe(true);
      expect(result.reviewedFiles).toContain('new-feature.ts');
    });
  });

  describe('Different review modes', () => {
    beforeEach(() => {
      // Create a file with potential issues
      const testFile = path.join(testDir, 'risky-code.ts');
      fs.writeFileSync(testFile, `
const password = "secret123";
function slowFunction(arr: number[]) {
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length; j++) {
      console.log(arr[i] + arr[j]);
    }
  }
}
`);
      execSync('git add risky-code.ts', { cwd: testDir, stdio: 'pipe' });
    });

    it('should use security-focused prompt for security mode', async () => {
      mockProviderManager.sendMessage.mockResolvedValue({
        content: JSON.stringify([{
          severity: 'critical',
          category: 'secrets',
          file: 'risky-code.ts',
          line: 1,
          title: 'Hardcoded password',
          description: 'Password should not be in source code',
          suggestion: 'Use environment variables',
        }]),
        finishReason: 'stop',
      });

      const result = await reviewCommand.execute({ staged: true, mode: 'security' });

      expect(result.mode).toBe('security');
      expect(mockProviderManager.sendMessage).toHaveBeenCalled();

      const systemPrompt = mockProviderManager.sendMessage.mock.calls[0][1][0].content;
      expect(systemPrompt).toContain('security-focused code reviewer');
      expect(systemPrompt).toContain('SQL injection');
      expect(systemPrompt).toContain('XSS');
    });

    it('should use performance-focused prompt for performance mode', async () => {
      mockProviderManager.sendMessage.mockResolvedValue({
        content: JSON.stringify([{
          severity: 'high',
          category: 'complexity',
          file: 'risky-code.ts',
          line: 3,
          title: 'O(n^2) complexity',
          description: 'Nested loop causes quadratic time complexity',
          suggestion: 'Optimize the algorithm',
        }]),
        finishReason: 'stop',
      });

      const result = await reviewCommand.execute({ staged: true, mode: 'performance' });

      expect(result.mode).toBe('performance');

      const systemPrompt = mockProviderManager.sendMessage.mock.calls[0][1][0].content;
      expect(systemPrompt).toContain('performance-focused code reviewer');
      expect(systemPrompt).toContain('complexity');
      expect(systemPrompt).toContain('memory');
    });

    it('should use style-focused prompt for style mode', async () => {
      mockProviderManager.sendMessage.mockResolvedValue({
        content: JSON.stringify([{
          severity: 'low',
          category: 'naming',
          file: 'risky-code.ts',
          line: 3,
          title: 'Inconsistent naming',
          description: 'Function name could be more descriptive',
          suggestion: 'Rename to processArrayPairs',
        }]),
        finishReason: 'stop',
      });

      const result = await reviewCommand.execute({ staged: true, mode: 'style' });

      expect(result.mode).toBe('style');

      const systemPrompt = mockProviderManager.sendMessage.mock.calls[0][1][0].content;
      expect(systemPrompt).toContain('code style reviewer');
      expect(systemPrompt).toContain('naming');
      expect(systemPrompt).toContain('formatting');
    });
  });

  describe('Output formatting', () => {
    it('should format findings with all severity levels', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'const x = 1;\n');
      execSync('git add test.ts', { cwd: testDir, stdio: 'pipe' });

      mockProviderManager.sendMessage.mockResolvedValue({
        content: JSON.stringify([
          { severity: 'critical', category: 'security', file: 'test.ts', line: 1, title: 'Critical Issue', description: 'Critical problem', suggestion: 'Fix it immediately' },
          { severity: 'high', category: 'bug', file: 'test.ts', line: 1, title: 'High Issue', description: 'High priority problem' },
          { severity: 'medium', category: 'quality', file: 'test.ts', title: 'Medium Issue', description: 'Medium priority' },
          { severity: 'low', category: 'style', file: 'test.ts', title: 'Low Issue', description: 'Minor issue' },
        ]),
        finishReason: 'stop',
      });

      const result = await reviewCommand.execute({ staged: true });
      const formatted = reviewCommand.formatFindings(result);

      expect(formatted).toContain('CRITICAL');
      expect(formatted).toContain('HIGH');
      expect(formatted).toContain('MEDIUM');
      expect(formatted).toContain('LOW');
      expect(formatted).toContain('Critical Issue');
      expect(formatted).toContain('Suggestion:');
    });

    it('should show pass message when no issues found', async () => {
      const testFile = path.join(testDir, 'clean.ts');
      fs.writeFileSync(testFile, 'export const clean = true;\n');
      execSync('git add clean.ts', { cwd: testDir, stdio: 'pipe' });

      mockProviderManager.sendMessage.mockResolvedValue({
        content: '[]',
        finishReason: 'stop',
      });

      const result = await reviewCommand.execute({ staged: true });
      const formatted = reviewCommand.formatFindings(result);

      expect(formatted).toContain('All checks passed!');
    });
  });

  describe('Provider integration', () => {
    it('should initialize provider before sending message', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'const x = 1;\n');
      execSync('git add test.ts', { cwd: testDir, stdio: 'pipe' });

      await reviewCommand.execute({ staged: true });

      expect(mockProviderManager.initializeProvider).toHaveBeenCalled();
      expect(mockProviderManager.sendMessage).toHaveBeenCalled();
    });

    it('should use configured provider and model', async () => {
      mockConfigManager.getConfig.mockReturnValue({
        defaultProvider: 'openai',
        defaultModel: 'gpt-4',
        maxConversations: 10,
        theme: 'dark' as const,
        providers: {} as any,
        cachedModels: {} as any,
        lastSelectedProvider: 'openai',
        lastSelectedModel: 'gpt-4',
      });

      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'const x = 1;\n');
      execSync('git add test.ts', { cwd: testDir, stdio: 'pipe' });

      await reviewCommand.execute({ staged: true });

      expect(mockProviderManager.initializeProvider).toHaveBeenCalledWith('openai');
    });

    it('should allow override of provider and model via options', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'const x = 1;\n');
      execSync('git add test.ts', { cwd: testDir, stdio: 'pipe' });

      await reviewCommand.execute({
        staged: true,
        provider: 'anthropic',
        model: 'claude-3-opus',
      });

      expect(mockProviderManager.initializeProvider).toHaveBeenCalledWith('anthropic');
      // Model should be passed to sendMessage
      const sendMessageCall = mockProviderManager.sendMessage.mock.calls[0];
      expect(sendMessageCall[2]).toBe('claude-3-opus');
    });
  });

  describe('Error handling', () => {
    it('should handle provider initialization errors', async () => {
      mockProviderManager.initializeProvider.mockRejectedValue(new Error('Provider not configured'));

      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'const x = 1;\n');
      execSync('git add test.ts', { cwd: testDir, stdio: 'pipe' });

      const result = await reviewCommand.execute({ staged: true });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Provider not configured');
    });

    it('should handle LLM API errors', async () => {
      mockProviderManager.sendMessage.mockRejectedValue(new Error('API rate limit exceeded'));

      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'const x = 1;\n');
      execSync('git add test.ts', { cwd: testDir, stdio: 'pipe' });

      const result = await reviewCommand.execute({ staged: true });

      expect(result.success).toBe(false);
      expect(result.error).toContain('API rate limit exceeded');
    });
  });
});
