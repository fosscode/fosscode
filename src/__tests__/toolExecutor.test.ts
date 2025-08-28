/**
 * @jest-environment node
 */
import { executeToolCalls, getOpenAIToolsFormat, hasAvailableTools } from '../utils/toolExecutor';
import { ToolResult } from '../types';

// Mock the tools module
jest.mock('../tools/init.js', () => ({
  listAvailableTools: jest.fn(),
  getTool: jest.fn(),
}));

// Import the mocked functions
import { listAvailableTools, getTool } from '../tools/init.js';

const mockListAvailableTools = listAvailableTools as jest.MockedFunction<typeof listAvailableTools>;
const mockGetTool = getTool as jest.MockedFunction<typeof getTool>;

describe('toolExecutor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeToolCalls', () => {
    it('should execute tool calls successfully', async () => {
      const toolCalls = [
        {
          function: {
            name: 'read',
            arguments: JSON.stringify({ filePath: '/test/file.txt' }),
          },
        },
      ];

      const mockTool = {
        execute: jest.fn(),
      };

      const mockResult: ToolResult = {
        success: true,
        data: { filePath: '/test/file.txt', content: 'test content', lines: 1 },
      };

      mockTool.execute.mockResolvedValue(mockResult);
      mockGetTool.mockReturnValue(mockTool as any);

      const result = await executeToolCalls(toolCalls);

      expect(result.content).toContain('Executing tools to help with your request...');
      expect(result.content).toContain('[Tool Calls Executed]:');
      expect(result.hasToolCalls).toBe(true);
      expect(mockTool.execute).toHaveBeenCalledWith({ filePath: '/test/file.txt' });
    });

    it('should handle tool not found', async () => {
      const toolCalls = [
        {
          function: {
            name: 'nonexistent',
            arguments: JSON.stringify({}),
          },
        },
      ];

      mockGetTool.mockReturnValue(undefined);

      const result = await executeToolCalls(toolCalls);

      expect(result.content).toContain('❌ nonexistent: Tool not found');
      expect(result.hasToolCalls).toBe(true);
    });

    it('should handle invalid JSON arguments', async () => {
      const toolCalls = [
        {
          function: {
            name: 'read',
            arguments: 'invalid json',
          },
        },
      ];

      const result = await executeToolCalls(toolCalls);

      expect(result.content).toContain('❌ read: Invalid arguments');
      expect(result.hasToolCalls).toBe(true);
    });

    it('should handle empty tool calls array', async () => {
      const result = await executeToolCalls([]);

      expect(result.content).toContain('Executing tools to help with your request...');
      expect(result.content).toContain('[Tool Calls Executed]:');
      expect(result.hasToolCalls).toBe(false);
    });
  });

  describe('getOpenAIToolsFormat', () => {
    it('should convert tools to OpenAI format', () => {
      const mockTools = [
        {
          name: 'read',
          description: 'Read file contents',
          parameters: [
            {
              name: 'filePath',
              type: 'string' as const,
              description: 'Path to the file',
              required: true,
            },
            {
              name: 'encoding',
              type: 'string' as const,
              description: 'File encoding',
              required: false,
              defaultValue: 'utf8',
            },
          ],
        },
      ];

      mockListAvailableTools.mockReturnValue(mockTools);

      const result = getOpenAIToolsFormat();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'function',
        function: {
          name: 'read',
          description: 'Read file contents',
          parameters: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Path to the file',
              },
              encoding: {
                type: 'string',
                description: 'File encoding',
                default: 'utf8',
              },
            },
            required: ['filePath'],
          },
        },
      });
    });

    it('should filter tools for thinking mode', () => {
      const mockTools = [
        {
          name: 'read',
          description: 'Read file contents',
          parameters: [],
        },
        {
          name: 'bash',
          description: 'Execute bash commands',
          parameters: [],
        },
      ];

      mockListAvailableTools.mockReturnValue(mockTools);

      const result = getOpenAIToolsFormat('thinking');

      expect(result).toHaveLength(1);
      expect(result[0].function.name).toBe('read');
    });

    it('should handle empty tools list', () => {
      mockListAvailableTools.mockReturnValue([]);

      const result = getOpenAIToolsFormat();

      expect(result).toEqual([]);
    });
  });

  describe('hasAvailableTools', () => {
    it('should return true when tools are available', () => {
      mockListAvailableTools.mockReturnValue([
        { name: 'read', description: 'Read files', parameters: [] },
      ]);

      const result = hasAvailableTools();

      expect(result).toBe(true);
      expect(mockListAvailableTools).toHaveBeenCalled();
    });

    it('should return false when no tools are available', () => {
      mockListAvailableTools.mockReturnValue([]);

      const result = hasAvailableTools();

      expect(result).toBe(false);
      expect(mockListAvailableTools).toHaveBeenCalled();
    });
  });
});
