import { ReviewCommand, ReviewResult, ReviewFinding } from '../commands/ReviewCommand';
import { ProviderManager } from '../providers/ProviderManager';
import { ConfigManager } from '../config/ConfigManager';
import * as child_process from 'child_process';

// Mock dependencies
jest.mock('../providers/ProviderManager');
jest.mock('../config/ConfigManager');
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

describe('ReviewCommand', () => {
  let reviewCommand: ReviewCommand;
  let mockProviderManager: jest.Mocked<ProviderManager>;
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockExecSync: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock ConfigManager
    mockConfigManager = {
      getConfig: jest.fn().mockReturnValue({
        lastSelectedProvider: 'mock',
        lastSelectedModel: 'mock-model',
      }),
      getProviderConfig: jest.fn().mockReturnValue({}),
      loadConfig: jest.fn(),
      setConfig: jest.fn(),
    } as unknown as jest.Mocked<ConfigManager>;

    // Setup mock ProviderManager
    mockProviderManager = {
      sendMessage: jest.fn(),
      initializeProvider: jest.fn().mockResolvedValue(undefined),
      listModels: jest.fn().mockResolvedValue(['mock-model']),
      getAvailableProviders: jest.fn().mockReturnValue(['mock']),
      testConnection: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<ProviderManager>;

    // Mock ConfigManager constructor
    (ConfigManager as jest.Mock).mockImplementation(() => mockConfigManager);

    // Mock ProviderManager constructor
    (ProviderManager as jest.Mock).mockImplementation(() => mockProviderManager);

    // Setup mock execSync
    mockExecSync = child_process.execSync as jest.Mock;

    reviewCommand = new ReviewCommand(mockConfigManager, mockProviderManager);
  });

  describe('execute', () => {
    it('should return empty findings when no changes to review', async () => {
      mockExecSync.mockReturnValue('');

      const result = await reviewCommand.execute({ staged: true });

      expect(result.success).toBe(true);
      expect(result.findings).toHaveLength(0);
      expect(result.summary).toBe('No changes to review.');
    });

    it('should parse JSON findings from LLM response', async () => {
      const mockDiff = `diff --git a/test.ts b/test.ts
--- a/test.ts
+++ b/test.ts
@@ -1,3 +1,5 @@
+const password = "secret123";
 function test() {
   return true;
 }`;

      mockExecSync
        .mockReturnValueOnce(mockDiff) // diff command
        .mockReturnValueOnce('test.ts\n') // files command
        .mockReturnValueOnce('1 file changed, 2 insertions(+), 0 deletions(-)'); // stats

      mockProviderManager.sendMessage.mockResolvedValue({
        content: JSON.stringify([
          {
            severity: 'critical',
            category: 'secrets',
            file: 'test.ts',
            line: 1,
            title: 'Hardcoded password',
            description: 'Password is hardcoded in source code',
            suggestion: 'Use environment variables instead',
          },
        ]),
        finishReason: 'stop',
      });

      const result = await reviewCommand.execute({ staged: true, mode: 'security' });

      expect(result.success).toBe(true);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].severity).toBe('critical');
      expect(result.findings[0].category).toBe('secrets');
      expect(result.findings[0].title).toBe('Hardcoded password');
    });

    it('should sort findings by severity', async () => {
      const mockDiff = 'some diff content';

      mockExecSync
        .mockReturnValueOnce(mockDiff)
        .mockReturnValueOnce('file1.ts\nfile2.ts\n')
        .mockReturnValueOnce('2 files changed, 10 insertions(+), 5 deletions(-)');

      mockProviderManager.sendMessage.mockResolvedValue({
        content: JSON.stringify([
          { severity: 'low', category: 'style', file: 'file1.ts', title: 'Low issue', description: 'desc' },
          { severity: 'critical', category: 'bug', file: 'file2.ts', title: 'Critical issue', description: 'desc' },
          { severity: 'medium', category: 'quality', file: 'file1.ts', title: 'Medium issue', description: 'desc' },
          { severity: 'high', category: 'security', file: 'file2.ts', title: 'High issue', description: 'desc' },
        ]),
        finishReason: 'stop',
      });

      const result = await reviewCommand.execute({ staged: true });

      expect(result.success).toBe(true);
      expect(result.findings).toHaveLength(4);
      expect(result.findings[0].severity).toBe('critical');
      expect(result.findings[1].severity).toBe('high');
      expect(result.findings[2].severity).toBe('medium');
      expect(result.findings[3].severity).toBe('low');
    });

    it('should handle different review modes', async () => {
      const mockDiff = 'some diff';
      mockExecSync.mockReturnValue(mockDiff);
      mockExecSync.mockReturnValueOnce(mockDiff);
      mockExecSync.mockReturnValueOnce('test.ts\n');
      mockExecSync.mockReturnValueOnce('1 file changed');

      mockProviderManager.sendMessage.mockResolvedValue({
        content: '[]',
        finishReason: 'stop',
      });

      // Test security mode
      const result = await reviewCommand.execute({ staged: true, mode: 'security' });
      expect(result.mode).toBe('security');

      // Verify the system prompt contains security-specific content
      const securityCall = mockProviderManager.sendMessage.mock.calls[0];
      expect(securityCall[1][0].content).toContain('security-focused code reviewer');
    });

    it('should handle staged changes option', async () => {
      mockExecSync
        .mockReturnValueOnce('staged diff content')
        .mockReturnValueOnce('staged.ts\n')
        .mockReturnValueOnce('1 file changed');

      mockProviderManager.sendMessage.mockResolvedValue({
        content: '[]',
        finishReason: 'stop',
      });

      await reviewCommand.execute({ staged: true });

      // Verify git diff --cached was called
      expect(mockExecSync).toHaveBeenCalledWith(
        'git diff --cached',
        expect.any(Object)
      );
    });

    it('should handle specific commit option', async () => {
      const commitSha = 'abc123';
      mockExecSync
        .mockReturnValueOnce('commit diff content')
        .mockReturnValueOnce('file.ts\n')
        .mockReturnValueOnce('1 file changed');

      mockProviderManager.sendMessage.mockResolvedValue({
        content: '[]',
        finishReason: 'stop',
      });

      await reviewCommand.execute({ commit: commitSha });

      expect(mockExecSync).toHaveBeenCalledWith(
        `git show ${commitSha} --format=""`,
        expect.any(Object)
      );
    });

    it('should handle base branch comparison', async () => {
      mockExecSync
        .mockReturnValueOnce('branch diff content')
        .mockReturnValueOnce('file.ts\n')
        .mockReturnValueOnce('1 file changed');

      mockProviderManager.sendMessage.mockResolvedValue({
        content: '[]',
        finishReason: 'stop',
      });

      await reviewCommand.execute({ baseBranch: 'develop' });

      expect(mockExecSync).toHaveBeenCalledWith(
        'git diff develop...HEAD',
        expect.any(Object)
      );
    });

    it('should handle git command errors', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repository');
      });

      const result = await reviewCommand.execute({ staged: true });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle LLM response parsing errors gracefully', async () => {
      mockExecSync
        .mockReturnValueOnce('some diff')
        .mockReturnValueOnce('file.ts\n')
        .mockReturnValueOnce('1 file changed');

      mockProviderManager.sendMessage.mockResolvedValue({
        content: 'This is not valid JSON at all',
        finishReason: 'stop',
      });

      // Should not throw, should return empty findings
      const result = await reviewCommand.execute({ staged: true });

      expect(result.success).toBe(true);
      expect(result.findings).toHaveLength(0);
    });

    it('should handle empty LLM response', async () => {
      mockExecSync
        .mockReturnValueOnce('some diff')
        .mockReturnValueOnce('file.ts\n')
        .mockReturnValueOnce('1 file changed');

      mockProviderManager.sendMessage.mockResolvedValue({
        content: '',
        finishReason: 'stop',
      });

      const result = await reviewCommand.execute({ staged: true });

      expect(result.success).toBe(true);
      expect(result.findings).toHaveLength(0);
    });
  });

  describe('formatFindings', () => {
    it('should format successful result with no findings', () => {
      const result: ReviewResult = {
        success: true,
        mode: 'general',
        findings: [],
        summary: 'No general issues found in 1 file(s). Code review passed!',
        reviewedFiles: ['test.ts'],
        totalChanges: 10,
      };

      const formatted = reviewCommand.formatFindings(result);

      expect(formatted).toContain('Code Review Results');
      expect(formatted).toContain('general mode');
      expect(formatted).toContain('All checks passed!');
    });

    it('should format findings grouped by severity', () => {
      const findings: ReviewFinding[] = [
        {
          severity: 'critical',
          category: 'security',
          file: 'auth.ts',
          line: 42,
          title: 'SQL Injection',
          description: 'User input not sanitized',
          suggestion: 'Use parameterized queries',
        },
        {
          severity: 'low',
          category: 'style',
          file: 'utils.ts',
          title: 'Inconsistent naming',
          description: 'Variable names should be camelCase',
        },
      ];

      const result: ReviewResult = {
        success: true,
        mode: 'security',
        findings,
        summary: 'Found 2 security issue(s)',
        reviewedFiles: ['auth.ts', 'utils.ts'],
        totalChanges: 50,
      };

      const formatted = reviewCommand.formatFindings(result);

      expect(formatted).toContain('CRITICAL');
      expect(formatted).toContain('SQL Injection');
      expect(formatted).toContain('LOW');
      expect(formatted).toContain('Inconsistent naming');
      expect(formatted).toContain('auth.ts:42');
      expect(formatted).toContain('Suggestion:');
    });

    it('should format failed review result', () => {
      const result: ReviewResult = {
        success: false,
        mode: 'general',
        findings: [],
        summary: 'Review failed: Git error',
        reviewedFiles: [],
        totalChanges: 0,
        error: 'Git error',
      };

      const formatted = reviewCommand.formatFindings(result);

      expect(formatted).toContain('Review failed');
      expect(formatted).toContain('Git error');
    });
  });

  describe('severity normalization', () => {
    it('should normalize invalid severity to medium', async () => {
      mockExecSync
        .mockReturnValueOnce('diff content')
        .mockReturnValueOnce('file.ts\n')
        .mockReturnValueOnce('1 file changed');

      mockProviderManager.sendMessage.mockResolvedValue({
        content: JSON.stringify([
          {
            severity: 'INVALID_SEVERITY',
            category: 'test',
            file: 'test.ts',
            title: 'Test',
            description: 'Test desc',
          },
        ]),
        finishReason: 'stop',
      });

      const result = await reviewCommand.execute({ staged: true });

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].severity).toBe('medium');
    });

    it('should normalize severity case-insensitively', async () => {
      mockExecSync
        .mockReturnValueOnce('diff content')
        .mockReturnValueOnce('file.ts\n')
        .mockReturnValueOnce('1 file changed');

      mockProviderManager.sendMessage.mockResolvedValue({
        content: JSON.stringify([
          { severity: 'CRITICAL', category: 'bug', file: 'a.ts', title: 'A', description: 'd' },
          { severity: 'High', category: 'bug', file: 'b.ts', title: 'B', description: 'd' },
          { severity: 'MEDIUM', category: 'bug', file: 'c.ts', title: 'C', description: 'd' },
          { severity: 'low', category: 'bug', file: 'd.ts', title: 'D', description: 'd' },
        ]),
        finishReason: 'stop',
      });

      const result = await reviewCommand.execute({ staged: true });

      expect(result.findings[0].severity).toBe('critical');
      expect(result.findings[1].severity).toBe('high');
      expect(result.findings[2].severity).toBe('medium');
      expect(result.findings[3].severity).toBe('low');
    });
  });

  describe('summary generation', () => {
    it('should generate correct summary with mixed severities', async () => {
      mockExecSync
        .mockReturnValueOnce('diff')
        .mockReturnValueOnce('file1.ts\nfile2.ts\nfile3.ts\n')
        .mockReturnValueOnce('3 files changed, 100 insertions(+), 50 deletions(-)');

      mockProviderManager.sendMessage.mockResolvedValue({
        content: JSON.stringify([
          { severity: 'critical', category: 'a', file: 'f', title: 't', description: 'd' },
          { severity: 'critical', category: 'a', file: 'f', title: 't', description: 'd' },
          { severity: 'high', category: 'a', file: 'f', title: 't', description: 'd' },
          { severity: 'medium', category: 'a', file: 'f', title: 't', description: 'd' },
          { severity: 'medium', category: 'a', file: 'f', title: 't', description: 'd' },
          { severity: 'medium', category: 'a', file: 'f', title: 't', description: 'd' },
          { severity: 'low', category: 'a', file: 'f', title: 't', description: 'd' },
        ]),
        finishReason: 'stop',
      });

      const result = await reviewCommand.execute({ staged: true });

      expect(result.summary).toContain('7 general issue(s)');
      expect(result.summary).toContain('2 critical');
      expect(result.summary).toContain('1 high');
      expect(result.summary).toContain('3 medium');
      expect(result.summary).toContain('1 low');
    });
  });
});
