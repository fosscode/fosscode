import { LSPDefinitionTool } from '../tools/LSPDefinitionTool.js';
import * as fs from 'fs';
import * as path from 'path';

// Use project directory for temp files to satisfy security manager
const projectRoot = process.cwd();
const testFixturesDir = path.join(projectRoot, 'src', '__tests__', '__fixtures__', 'lsp-def-test');

describe('LSPDefinitionTool', () => {
  let lspDefinitionTool: LSPDefinitionTool;
  let tempDir: string;

  beforeAll(async () => {
    // Ensure the fixtures directory exists
    await fs.promises.mkdir(testFixturesDir, { recursive: true });
  });

  beforeEach(async () => {
    lspDefinitionTool = new LSPDefinitionTool();
    // Create unique temp dir within project for each test
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    tempDir = path.join(testFixturesDir, uniqueId);
    await fs.promises.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  afterAll(async () => {
    // Clean up fixtures directory
    try {
      await fs.promises.rm(testFixturesDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('basic functionality', () => {
    it('should have correct name and description', () => {
      expect(lspDefinitionTool.name).toBe('lsp-definition');
      expect(lspDefinitionTool.description).toContain('definition');
    });

    it('should have required parameters', () => {
      expect(lspDefinitionTool.parameters).toHaveLength(7);

      const fileParam = lspDefinitionTool.parameters.find(p => p.name === 'file');
      const lineParam = lspDefinitionTool.parameters.find(p => p.name === 'line');
      const characterParam = lspDefinitionTool.parameters.find(p => p.name === 'character');

      expect(fileParam?.required).toBe(true);
      expect(lineParam?.required).toBe(true);
      expect(characterParam?.required).toBe(true);
    });

    it('should have optional parameters with defaults', () => {
      const includeContextParam = lspDefinitionTool.parameters.find(
        p => p.name === 'includeContext'
      );
      const contextLinesParam = lspDefinitionTool.parameters.find(p => p.name === 'contextLines');

      expect(includeContextParam?.defaultValue).toBe(true);
      expect(contextLinesParam?.defaultValue).toBe(3);
    });
  });

  describe('execute method validation', () => {
    it('should return error for missing file', async () => {
      const result = await lspDefinitionTool.execute({
        line: 1,
        character: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('File parameter is required');
    });

    it('should return error for empty file', async () => {
      const result = await lspDefinitionTool.execute({
        file: '',
        line: 1,
        character: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('File parameter is required');
    });

    it('should return error for invalid line number', async () => {
      const result = await lspDefinitionTool.execute({
        file: 'test.js',
        line: 0,
        character: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Line parameter is required and must be a positive number');
    });

    it('should return error for negative character position', async () => {
      const result = await lspDefinitionTool.execute({
        file: 'test.js',
        line: 1,
        character: -1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'Character parameter is required and must be a non-negative number'
      );
    });
  });

  describe('language detection', () => {
    it('should detect TypeScript files', () => {
      const tool = lspDefinitionTool as any;
      expect(tool.detectLanguage('test.ts')).toBe('typescript');
      expect(tool.detectLanguage('component.tsx')).toBe('typescript');
    });

    it('should detect JavaScript files', () => {
      const tool = lspDefinitionTool as any;
      expect(tool.detectLanguage('script.js')).toBe('javascript');
      expect(tool.detectLanguage('app.jsx')).toBe('javascript');
    });

    it('should detect Python files', () => {
      const tool = lspDefinitionTool as any;
      expect(tool.detectLanguage('script.py')).toBe('python');
    });

    it('should detect Go files', () => {
      const tool = lspDefinitionTool as any;
      expect(tool.detectLanguage('main.go')).toBe('go');
    });

    it('should return plaintext for unknown extensions', () => {
      const tool = lspDefinitionTool as any;
      expect(tool.detectLanguage('unknown.xyz')).toBe('plaintext');
    });
  });

  describe('symbol extraction', () => {
    it('should extract simple identifiers', () => {
      const tool = lspDefinitionTool as any;
      const line = 'const variableName = 42;';
      const symbol = tool.extractSymbolAtPosition(line, 8, 'javascript');

      expect(symbol).toBe('variableName');
    });

    it('should extract function names', () => {
      const tool = lspDefinitionTool as any;
      const line = 'function myFunction() {';
      const symbol = tool.extractSymbolAtPosition(line, 12, 'javascript');

      expect(symbol).toBe('myFunction');
    });

    it('should return null for positions without symbols', () => {
      const tool = lspDefinitionTool as any;
      const line = 'const x = 42;';
      const symbol = tool.extractSymbolAtPosition(line, 12, 'javascript');

      expect(symbol).toBeNull();
    });
  });

  describe('definition finding', () => {
    it('should find function definition in JavaScript', async () => {
      const content = `
function myFunction(a, b) {
  return a + b;
}

const result = myFunction(1, 2);
`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspDefinitionTool.execute({
        file: testFile,
        line: 6,
        character: 16,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbol).toBe('myFunction');
      expect(result.data?.definition).toBeDefined();
      expect(result.data?.definition?.kind).toBe('function');
    });

    it('should find class definition in JavaScript', async () => {
      const content = `
class MyClass {
  constructor() {}
}

const instance = new MyClass();
`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspDefinitionTool.execute({
        file: testFile,
        line: 6,
        character: 22,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbol).toBe('MyClass');
      expect(result.data?.definition).toBeDefined();
      expect(result.data?.definition?.kind).toBe('class');
    });

    it('should return message when no definition found', async () => {
      const content = 'const x = undefinedSymbol;';
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspDefinitionTool.execute({
        file: testFile,
        line: 1,
        character: 12,
      });

      expect(result.success).toBe(true);
      expect(result.data?.message).toContain('No definition found');
    });

    it('should find Python function definition', async () => {
      const content = `
def my_function(a, b):
    return a + b

result = my_function(1, 2)
`;
      const testFile = path.join(tempDir, 'test.py');
      await fs.promises.writeFile(testFile, content);

      const result = await lspDefinitionTool.execute({
        file: testFile,
        line: 5,
        character: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbol).toBe('my_function');
      expect(result.data?.definition).toBeDefined();
    });

    it('should find Go function definition', async () => {
      const content = `package main

func myFunction(a, b int) int {
    return a + b
}

func main() {
    result := myFunction(1, 2)
}
`;
      const testFile = path.join(tempDir, 'test.go');
      await fs.promises.writeFile(testFile, content);

      const result = await lspDefinitionTool.execute({
        file: testFile,
        line: 8,
        character: 14,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbol).toBe('myFunction');
    });
  });

  describe('context snippets', () => {
    it('should include context when requested', async () => {
      const content = `
function myFunction(a, b) {
  return a + b;
}

const result = myFunction(1, 2);
`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspDefinitionTool.execute({
        file: testFile,
        line: 6,
        character: 16,
        includeContext: true,
        contextLines: 2,
      });

      expect(result.success).toBe(true);
      expect(result.data?.definition?.context).toBeDefined();
      expect(result.data?.definition?.context?.lines).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle line beyond file end', async () => {
      const content = 'const x = 1;';
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspDefinitionTool.execute({
        file: testFile,
        line: 100,
        character: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('beyond the end of the file');
    });

    it('should handle character beyond line end', async () => {
      const content = 'const x = 1;';
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspDefinitionTool.execute({
        file: testFile,
        line: 1,
        character: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('beyond the end of line');
    });

    it('should return no symbol for empty position', async () => {
      const content = '   ';
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspDefinitionTool.execute({
        file: testFile,
        line: 1,
        character: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data?.message).toContain('No symbol found');
    });
  });
});
