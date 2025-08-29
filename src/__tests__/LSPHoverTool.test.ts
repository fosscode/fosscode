import { LSPHoverTool } from '../tools/LSPHoverTool.js';

describe('LSPHoverTool', () => {
  let lspHoverTool: LSPHoverTool;

  beforeEach(() => {
    lspHoverTool = new LSPHoverTool();
  });

  describe('basic functionality', () => {
    it('should have correct name and description', () => {
      expect(lspHoverTool.name).toBe('lsp-hover');
      expect(lspHoverTool.description).toContain('Language Server Protocol');
    });

    it('should have required parameters', () => {
      expect(lspHoverTool.parameters).toHaveLength(7);
      const fileParam = lspHoverTool.parameters.find(p => p.name === 'file');
      const lineParam = lspHoverTool.parameters.find(p => p.name === 'line');
      const characterParam = lspHoverTool.parameters.find(p => p.name === 'character');

      expect(fileParam?.required).toBe(true);
      expect(lineParam?.required).toBe(true);
      expect(characterParam?.required).toBe(true);
    });

    it('should have optional parameters with defaults', () => {
      const includeRangeParam = lspHoverTool.parameters.find(p => p.name === 'includeRange');
      const includeDefinitionParam = lspHoverTool.parameters.find(
        p => p.name === 'includeDefinition'
      );
      const contextLinesParam = lspHoverTool.parameters.find(p => p.name === 'contextLines');

      expect(includeRangeParam?.defaultValue).toBe(true);
      expect(includeDefinitionParam?.defaultValue).toBe(true);
      expect(contextLinesParam?.defaultValue).toBe(2);
    });
  });

  describe('execute method validation', () => {
    it('should return error for missing file', async () => {
      const result = await lspHoverTool.execute({
        line: 1,
        character: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('File parameter is required');
    });

    it('should return error for empty file', async () => {
      const result = await lspHoverTool.execute({
        file: '',
        line: 1,
        character: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('File parameter is required');
    });

    it('should return error for invalid line number', async () => {
      const result = await lspHoverTool.execute({
        file: 'test.js',
        line: 0,
        character: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Line parameter is required and must be a positive number');
    });

    it('should return error for negative character position', async () => {
      const result = await lspHoverTool.execute({
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
      const tool = lspHoverTool as any;
      expect(tool.detectLanguage('test.ts')).toBe('typescript');
      expect(tool.detectLanguage('component.tsx')).toBe('typescript');
    });

    it('should detect JavaScript files', () => {
      const tool = lspHoverTool as any;
      expect(tool.detectLanguage('script.js')).toBe('javascript');
      expect(tool.detectLanguage('app.jsx')).toBe('javascript');
    });

    it('should detect Python files', () => {
      const tool = lspHoverTool as any;
      expect(tool.detectLanguage('script.py')).toBe('python');
    });

    it('should return plaintext for unknown extensions', () => {
      const tool = lspHoverTool as any;
      expect(tool.detectLanguage('unknown.xyz')).toBe('plaintext');
    });
  });

  describe('symbol extraction', () => {
    it('should extract simple identifiers', () => {
      const tool = lspHoverTool as any;
      const line = 'const variableName = 42;';
      const symbol = tool.extractSymbolAtPosition(line, 8, 'javascript');

      expect(symbol).toBe('variableName');
    });

    it('should extract function names', () => {
      const tool = lspHoverTool as any;
      const line = 'function myFunction() {';
      const symbol = tool.extractSymbolAtPosition(line, 12, 'javascript');

      expect(symbol).toBe('myFunction');
    });

    it('should return null for positions without symbols', () => {
      const tool = lspHoverTool as any;
      const line = 'const x = 42;';
      const symbol = tool.extractSymbolAtPosition(line, 0, 'javascript');

      expect(symbol).toBeNull();
    });
  });

  describe('word regex patterns', () => {
    it('should create appropriate regex for JavaScript', () => {
      const tool = lspHoverTool as any;
      const regex = tool.getWordRegex('javascript');

      expect(regex.test('variable')).toBe(true);
      regex.lastIndex = 0; // Reset regex state
      expect(regex.test('functionName')).toBe(true);
      regex.lastIndex = 0; // Reset regex state
      expect(regex.test('object.property')).toBe(true);
    });

    it('should create appropriate regex for Python', () => {
      const tool = lspHoverTool as any;
      const regex = tool.getWordRegex('python');

      expect(regex.test('variable')).toBe(true);
      regex.lastIndex = 0; // Reset regex state
      expect(regex.test('function_name')).toBe(true);
      regex.lastIndex = 0; // Reset regex state
      expect(regex.test('module.function')).toBe(true);
    });
  });

  describe('JavaScript analysis', () => {
    it('should analyze function declarations', () => {
      const tool = lspHoverTool as any;
      const content = `
/**
 * This is a test function
 */
function testFunction(param1, param2) {
  return param1 + param2;
}
`;

      const result = tool.findFunctionDeclaration(content, 'testFunction');

      expect(result).not.toBeNull();
      expect(result?.signature).toBe('(param1, param2)');
      expect(result?.documentation).toContain('This is a test function');
    });

    it('should analyze arrow functions', () => {
      const tool = lspHoverTool as any;
      const content = 'const arrowFunc = (x, y) => x + y;';

      const result = tool.findFunctionDeclaration(content, 'arrowFunc');

      expect(result).not.toBeNull();
      expect(result?.signature).toBe('(x, y)');
    });

    it('should analyze class declarations', () => {
      const tool = lspHoverTool as any;
      const content = `
/**
 * Test class documentation
 */
class TestClass {
  constructor() {}
}
`;

      const result = tool.findClassDeclaration(content, 'TestClass');

      expect(result).not.toBeNull();
      expect(result?.documentation).toContain('Test class documentation');
    });

    it('should analyze variable declarations', () => {
      const tool = lspHoverTool as any;
      const content = 'const myVariable: string = "hello";';

      const result = tool.findVariableDeclaration(content, 'myVariable');

      expect(result).not.toBeNull();
      expect(result?.kind).toBe('const');
      expect(result?.type).toBe('string');
    });

    it('should analyze imports', () => {
      const tool = lspHoverTool as any;
      const content = 'import { myFunction } from "./utils";';

      const result = tool.findImport(content, 'myFunction');

      expect(result).not.toBeNull();
      expect(result?.from).toBe('./utils');
    });
  });

  describe('Python analysis', () => {
    it('should analyze function definitions', () => {
      const tool = lspHoverTool as any;
      const content = `
def test_function(param1, param2):
    """
    This is a test function
    """
    return param1 + param2
`;

      const result = tool.findPythonFunction(content, 'test_function');

      expect(result).not.toBeNull();
      expect(result?.signature).toBe('(param1, param2)');
      expect(result?.documentation).toContain('This is a test function');
    });

    it('should analyze class definitions', () => {
      const tool = lspHoverTool as any;
      const content = `
class TestClass:
    """
    Test class documentation
    """
    def __init__(self):
        pass
`;

      const result = tool.findPythonClass(content, 'TestClass');

      expect(result).not.toBeNull();
      expect(result?.documentation).toContain('Test class documentation');
    });

    it('should analyze variable assignments', () => {
      const tool = lspHoverTool as any;
      const content = 'my_variable = "hello world"';

      const result = tool.findPythonVariable(content, 'my_variable');

      expect(result).not.toBeNull();
      expect(result?.kind).toBe('variable');
    });
  });

  describe('documentation extraction', () => {
    it('should extract JSDoc comments', () => {
      const tool = lspHoverTool as any;
      const content = `
/**
 * This is a JSDoc comment
 * with multiple lines
 */
function test() {}
`;

      const documentation = tool.extractJSDocComment(content, 50);

      expect(documentation).toContain('This is a JSDoc comment');
      expect(documentation).toContain('with multiple lines');
    });

    it('should extract Python docstrings', () => {
      const tool = lspHoverTool as any;
      const content = `
def test():
    """
    This is a Python docstring
    with multiple lines
    """
    pass
`;

      const documentation = tool.extractPythonDocstring(content, 15);

      expect(documentation).toContain('This is a Python docstring');
      expect(documentation).toContain('with multiple lines');
    });
  });

  describe('context snippets', () => {
    it('should generate context snippets', () => {
      const tool = lspHoverTool as any;
      const lines = ['line 1', 'line 2', 'line 3', 'line 4', 'line 5'];

      const context = tool.getContextSnippet(lines, 2, 1);

      expect(context.startLine).toBe(2);
      expect(context.endLine).toBe(4);
      expect(context.lines).toHaveLength(3);
      expect(context.lines[1].isTarget).toBe(true);
    });

    it('should handle edge cases', () => {
      const tool = lspHoverTool as any;
      const lines = ['line 1', 'line 2'];

      const context = tool.getContextSnippet(lines, 0, 2);

      expect(context.startLine).toBe(1);
      expect(context.endLine).toBe(2);
      expect(context.lines).toHaveLength(2);
    });
  });

  describe('position conversion', () => {
    it('should convert character offset to line/character position', () => {
      const tool = lspHoverTool as any;
      const content = 'line 1\nline 2\nline 3';

      const position = tool.getPositionFromOffset(content, 10);

      expect(position.line).toBe(1);
      expect(position.character).toBe(6);
    });
  });
});
