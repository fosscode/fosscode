import { executeToolCalls } from '../utils/toolExecutor.js';
import { ApprovalManager } from '../utils/ApprovalManager.js';
import { AppConfig } from '../types/index.js';

// Mock the ApprovalManager
jest.mock('../utils/ApprovalManager.js');

describe('Tool Executor with Approval Mode', () => {
  let config: AppConfig;
  let mockApprovalManager: jest.Mocked<ApprovalManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    config = {
      defaultProvider: 'openai',
      defaultModel: 'gpt-4',
      maxConversations: 100,
      theme: 'dark',
      providers: {} as any,
      cachedModels: {} as any,
      approvalMode: {
        enabled: true,
        godMode: false,
        allowlist: ['rm', 'sudo'],
      },
    };

    mockApprovalManager = {
      needsApproval: jest.fn(),
      recordApproval: jest.fn(),
      clearSessionApprovals: jest.fn(),
      updateConfig: jest.fn(),
    } as any;

    (ApprovalManager as jest.MockedClass<typeof ApprovalManager>).mockImplementation(
      () => mockApprovalManager
    );
  });

  describe('Command tool approvals', () => {
    it('should require approval for dangerous bash commands', async () => {
      mockApprovalManager.needsApproval.mockReturnValue(true);

      const toolCalls = [
        {
          id: 'test-1',
          type: 'function',
          function: {
            name: 'bash',
            arguments: JSON.stringify({
              command: 'rm -rf /tmp/test',
            }),
          },
        },
      ];

      const result = await executeToolCalls(
        toolCalls,
        'code',
        undefined,
        undefined,
        mockApprovalManager
      );

      expect(mockApprovalManager.needsApproval).toHaveBeenCalledWith({
        type: 'command',
        command: 'rm -rf /tmp/test',
      });
      expect(result.content).toContain('Approval required');
    });

    it('should not require approval for safe bash commands', async () => {
      mockApprovalManager.needsApproval.mockReturnValue(false);

      const toolCalls = [
        {
          id: 'test-1',
          type: 'function',
          function: {
            name: 'bash',
            arguments: JSON.stringify({
              command: 'ls -la',
            }),
          },
        },
      ];

      const result = await executeToolCalls(
        toolCalls,
        'code',
        undefined,
        undefined,
        mockApprovalManager
      );

      expect(mockApprovalManager.needsApproval).toHaveBeenCalledWith({
        type: 'command',
        command: 'ls -la',
      });
      expect(result.content).not.toContain('Approval required');
    });

    it('should handle approval bypass in GOD mode', async () => {
      config.approvalMode!.godMode = true;
      mockApprovalManager.needsApproval.mockReturnValue(false);

      const toolCalls = [
        {
          id: 'test-1',
          type: 'function',
          function: {
            name: 'bash',
            arguments: JSON.stringify({
              command: 'rm -rf /',
            }),
          },
        },
      ];

      const result = await executeToolCalls(
        toolCalls,
        'code',
        undefined,
        undefined,
        mockApprovalManager
      );

      expect(mockApprovalManager.needsApproval).toHaveBeenCalledWith({
        type: 'command',
        command: 'rm -rf /',
      });
      expect(result.content).not.toContain('Approval required');
    });
  });

  describe('Edit tool approvals', () => {
    it('should always require approval for edit operations when mode is enabled', async () => {
      mockApprovalManager.needsApproval.mockReturnValue(true);

      const toolCalls = [
        {
          id: 'test-1',
          type: 'function',
          function: {
            name: 'edit',
            arguments: JSON.stringify({
              filePath: '/tmp/test.txt',
              oldString: 'old content',
              newString: 'new content',
            }),
          },
        },
      ];

      const result = await executeToolCalls(
        toolCalls,
        'code',
        undefined,
        undefined,
        mockApprovalManager
      );

      expect(mockApprovalManager.needsApproval).toHaveBeenCalledWith({
        type: 'edit',
        filePath: '/tmp/test.txt',
        oldString: 'old content',
        newString: 'new content',
      });
      expect(result.content).toContain('Approval required');
    });

    it('should not require approval for edits when GOD mode is enabled', async () => {
      config.approvalMode!.godMode = true;
      mockApprovalManager.needsApproval.mockReturnValue(false);

      const toolCalls = [
        {
          id: 'test-1',
          type: 'function',
          function: {
            name: 'edit',
            arguments: JSON.stringify({
              filePath: '/tmp/test.txt',
              oldString: 'old content',
              newString: 'new content',
            }),
          },
        },
      ];

      const result = await executeToolCalls(
        toolCalls,
        'code',
        undefined,
        undefined,
        mockApprovalManager
      );

      expect(mockApprovalManager.needsApproval).toHaveBeenCalledWith({
        type: 'edit',
        filePath: '/tmp/test.txt',
        oldString: 'old content',
        newString: 'new content',
      });
      expect(result.content).not.toContain('Approval required');
    });
  });

  describe('Other tools', () => {
    it('should not require approval for non-command/edit tools', async () => {
      const toolCalls = [
        {
          id: 'test-1',
          type: 'function',
          function: {
            name: 'grep',
            arguments: JSON.stringify({
              pattern: 'test',
              path: '/tmp',
            }),
          },
        },
      ];

      const result = await executeToolCalls(
        toolCalls,
        'code',
        undefined,
        undefined,
        mockApprovalManager
      );

      expect(mockApprovalManager.needsApproval).toHaveBeenCalledWith({
        type: 'command',
        command: '',
      });
      expect(result.content).not.toContain('Approval required');
    });
  });

  describe('Approval mode disabled', () => {
    it('should not check approvals when approval mode is disabled', async () => {
      config.approvalMode!.enabled = false;
      mockApprovalManager.needsApproval.mockReturnValue(false);

      const toolCalls = [
        {
          id: 'test-1',
          type: 'function',
          function: {
            name: 'bash',
            arguments: JSON.stringify({
              command: 'rm -rf /',
            }),
          },
        },
      ];

      const result = await executeToolCalls(
        toolCalls,
        'code',
        undefined,
        undefined,
        mockApprovalManager
      );

      expect(mockApprovalManager.needsApproval).toHaveBeenCalledWith({
        type: 'command',
        command: 'rm -rf /',
      });
      expect(result.content).not.toContain('Approval required');
    });
  });

  describe('Error handling', () => {
    it('should handle approval manager errors gracefully', async () => {
      mockApprovalManager.needsApproval.mockImplementation(() => {
        throw new Error('Approval check failed');
      });

      const toolCalls = [
        {
          id: 'test-1',
          type: 'function',
          function: {
            name: 'bash',
            arguments: JSON.stringify({
              command: 'ls -la',
            }),
          },
        },
      ];

      // Should not throw, should continue with tool execution
      await expect(
        executeToolCalls(toolCalls, 'code', undefined, undefined, mockApprovalManager)
      ).resolves.toBeDefined();
    });
  });
});
