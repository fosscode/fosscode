import { GlobTool } from '../tools/GlobTool';

describe('GlobTool', () => {
  let globTool: GlobTool;

  beforeEach(() => {
    globTool = new GlobTool();
  });

  describe('basic functionality', () => {
    it('should have correct name and description', () => {
      expect(globTool.name).toBe('glob');
      expect(globTool.description).toContain('Fast file pattern matching tool');
    });

    it('should have required parameters', () => {
      expect(globTool.parameters).toHaveLength(6);
      const patternParam = globTool.parameters.find(p => p.name === 'pattern');
      expect(patternParam?.required).toBe(true);
      expect(patternParam?.type).toBe('string');
    });
  });

  describe('execute method', () => {
    it('should return error for empty pattern', async () => {
      const result = await globTool.execute({ pattern: '' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Pattern parameter is required');
    });

    it('should return error for invalid pattern type', async () => {
      const result = await globTool.execute({ pattern: 123 as any });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Pattern parameter is required');
    });

    it('should return error for missing pattern', async () => {
      const result = await globTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Pattern parameter is required');
    });
  });

  describe('glob pattern conversion', () => {
    it('should convert simple wildcards to regex', () => {
      const tool = new GlobTool() as any;
      expect(tool.globToRegex('*.txt')).toBe('[^/]*\\.txt');
      expect(tool.globToRegex('test.*')).toBe('test\\.[^/]*');
    });

    it('should convert question marks to regex', () => {
      const tool = new GlobTool() as any;
      expect(tool.globToRegex('file?.txt')).toBe('file[^/]\\.txt');
    });

    it('should escape special regex characters', () => {
      const tool = new GlobTool() as any;
      expect(tool.globToRegex('file[1-5].txt')).toBe('file\\[1-5\\]\\.txt');
    });
  });

  describe('pattern matching', () => {
    it('should match simple patterns correctly', () => {
      const tool = new GlobTool() as any;

      expect(tool.matchesGlobPattern('/test/file.txt', '*.txt', '/test')).toBe(true);
      expect(tool.matchesGlobPattern('/test/file.js', '*.txt', '/test')).toBe(false);
    });
  });

  describe('ignore patterns', () => {
    it('should correctly identify ignored paths', () => {
      const tool = new GlobTool() as any;
      const ignorePatterns = ['node_modules/**', '.git/**'];

      // Note: shouldIgnore uses process.cwd() as basePath, so these tests assume
      // the current working directory structure
      expect(tool.shouldIgnore('node_modules/package.json', ignorePatterns)).toBe(true);
      expect(tool.shouldIgnore('src/file.ts', ignorePatterns)).toBe(false);
      expect(tool.shouldIgnore('.git/config', ignorePatterns)).toBe(true);
    });
  });
});
