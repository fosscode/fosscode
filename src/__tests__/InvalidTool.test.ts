import { InvalidTool } from '../tools/InvalidTool';

describe('InvalidTool', () => {
  let invalidTool: InvalidTool;

  beforeEach(() => {
    invalidTool = new InvalidTool();
  });

  describe('basic functionality', () => {
    it('should have correct name and description', () => {
      expect(invalidTool.name).toBe('invalid');
      expect(invalidTool.description).toContain('Handles invalid tool operations');
    });

    it('should have required parameters', () => {
      expect(invalidTool.parameters).toHaveLength(4);
      const operationParam = invalidTool.parameters.find(p => p.name === 'operation');
      expect(operationParam?.required).toBe(true);
      expect(operationParam?.type).toBe('string');
    });
  });

  describe('execute method', () => {
    it('should return error for missing operation', async () => {
      const result = await invalidTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Operation parameter is required');
    });

    it('should handle basic invalid operation', async () => {
      const result = await invalidTool.execute({
        operation: 'test_operation',
        reason: 'Test failure reason',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid operation: test_operation');
      expect(result.data).toHaveProperty('operation', 'test_operation');
      expect(result.data).toHaveProperty('reason', 'Test failure reason');
      expect(result.data).toHaveProperty('recoverySuggestions');
      expect(result.data).toHaveProperty('troubleshootingSteps');
    });

    it('should disable suggestions when requested', async () => {
      const result = await invalidTool.execute({
        operation: 'test_operation',
        suggestions: false,
      });

      expect(result.success).toBe(false);
      expect(result.data?.recoverySuggestions).toHaveLength(0);
    });
  });

  describe('error analysis', () => {
    it('should categorize file not found errors', () => {
      const tool = new InvalidTool() as any;
      const analysis = tool.analyzeError('read_file', 'File not found', '');

      expect(analysis.category).toBe('file_not_found');
      expect(analysis.severity).toBe('low');
      expect(analysis.errorCode).toMatch(/^ERR_FILE_NOT_FOUND_/);
    });

    it('should categorize permission errors', () => {
      const tool = new InvalidTool() as any;
      const analysis = tool.analyzeError('write_file', 'Permission denied', '');

      expect(analysis.category).toBe('permission_denied');
      expect(analysis.severity).toBe('medium');
    });

    it('should handle unknown errors', () => {
      const tool = new InvalidTool() as any;
      const analysis = tool.analyzeError('unknown_op', 'Some weird error', '');

      expect(analysis.category).toBe('unknown');
      expect(analysis.severity).toBe('medium');
    });
  });

  describe('suggestion generation', () => {
    it('should generate file-related suggestions', () => {
      const tool = new InvalidTool() as any;
      const suggestions = tool.generateSuggestions('read_file', 'File not found');

      expect(suggestions).toContain('Check if the file path is correct and the file exists');
      expect(suggestions).toContain('Verify file permissions and access rights');
    });

    it('should generate network-related suggestions', () => {
      const tool = new InvalidTool() as any;
      const suggestions = tool.generateSuggestions('api_call', 'Connection failed');

      expect(suggestions).toContain('Check network connectivity and firewall settings');
      expect(suggestions).toContain('Verify API endpoints and authentication credentials');
    });

    it('should generate general suggestions for unknown operations', () => {
      const tool = new InvalidTool() as any;
      const suggestions = tool.generateSuggestions('unknown', 'weird error');

      expect(suggestions).toContain('Review the operation parameters and try again');
      expect(suggestions).toContain('Check system logs for additional error details');
    });
  });
});
