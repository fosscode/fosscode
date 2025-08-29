import { MultieditTool } from '../tools/MultieditTool.js';

describe('MultieditTool', () => {
  let multieditTool: MultieditTool;

  beforeEach(() => {
    multieditTool = new MultieditTool();
  });

  describe('basic functionality', () => {
    it('should have correct name and description', () => {
      expect(multieditTool.name).toBe('multiedit');
      expect(multieditTool.description).toContain('bulk find-and-replace');
    });

    it('should have required parameters', () => {
      expect(multieditTool.parameters).toHaveLength(11);
      const patternParam = multieditTool.parameters.find(p => p.name === 'pattern');
      const findParam = multieditTool.parameters.find(p => p.name === 'find');
      const replaceParam = multieditTool.parameters.find(p => p.name === 'replace');

      expect(patternParam?.required).toBe(true);
      expect(findParam?.required).toBe(true);
      expect(replaceParam?.required).toBe(true);
    });

    it('should have optional parameters with defaults', () => {
      const pathParam = multieditTool.parameters.find(p => p.name === 'path');
      const maxFilesParam = multieditTool.parameters.find(p => p.name === 'maxFiles');
      const previewParam = multieditTool.parameters.find(p => p.name === 'preview');

      expect(pathParam?.required).toBe(false);
      expect(pathParam?.defaultValue).toBe(process.cwd());
      expect(maxFilesParam?.defaultValue).toBe(100);
      expect(previewParam?.defaultValue).toBe(false);
    });
  });

  describe('execute method validation', () => {
    it('should return error for missing pattern', async () => {
      const result = await multieditTool.execute({
        find: 'old',
        replace: 'new',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Pattern parameter is required');
    });

    it('should return error for empty pattern', async () => {
      const result = await multieditTool.execute({
        pattern: '',
        find: 'old',
        replace: 'new',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Pattern parameter is required');
    });

    it('should return error for invalid pattern type', async () => {
      const result = await multieditTool.execute({
        pattern: 123,
        find: 'old',
        replace: 'new',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Pattern parameter is required');
    });

    it('should return error for missing find', async () => {
      const result = await multieditTool.execute({
        pattern: '*.txt',
        replace: 'new',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Find parameter is required');
    });

    it('should return error for invalid find type', async () => {
      const result = await multieditTool.execute({
        pattern: '*.txt',
        find: 123,
        replace: 'new',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Find parameter is required');
    });

    it('should return error for invalid replace parameter', async () => {
      const result = await multieditTool.execute({
        pattern: '*.txt',
        find: 'old',
        replace: 123,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Replace parameter must be a string');
    });
  });

  describe('parameter configuration', () => {
    it('should support regex mode parameter', () => {
      const regexParam = multieditTool.parameters.find(p => p.name === 'regex');
      expect(regexParam?.type).toBe('boolean');
      expect(regexParam?.defaultValue).toBe(false);
    });

    it('should support case sensitivity parameter', () => {
      const caseParam = multieditTool.parameters.find(p => p.name === 'caseSensitive');
      expect(caseParam?.type).toBe('boolean');
      expect(caseParam?.defaultValue).toBe(true);
    });

    it('should support whole word parameter', () => {
      const wholeWordParam = multieditTool.parameters.find(p => p.name === 'wholeWord');
      expect(wholeWordParam?.type).toBe('boolean');
      expect(wholeWordParam?.defaultValue).toBe(false);
    });

    it('should support include and exclude patterns', () => {
      const includeParam = multieditTool.parameters.find(p => p.name === 'include');
      const excludeParam = multieditTool.parameters.find(p => p.name === 'exclude');

      expect(includeParam?.type).toBe('array');
      expect(excludeParam?.type).toBe('array');
      expect(includeParam?.required).toBe(false);
      expect(excludeParam?.required).toBe(false);
    });
  });

  describe('preview functionality', () => {
    it('should have preview parameter', () => {
      const previewParam = multieditTool.parameters.find(p => p.name === 'preview');
      expect(previewParam?.type).toBe('boolean');
      expect(previewParam?.description).toContain('Preview changes without applying them');
    });
  });
});
