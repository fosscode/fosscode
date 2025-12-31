import { LSPSymbolsTool } from '../tools/LSPSymbolsTool.js';
import * as fs from 'fs';
import * as path from 'path';

// Use project directory for temp files to satisfy security manager
const projectRoot = process.cwd();
const testFixturesDir = path.join(projectRoot, 'src', '__tests__', '__fixtures__', 'lsp-symbols-test');

describe('LSPSymbolsTool', () => {
  let lspSymbolsTool: LSPSymbolsTool;
  let tempDir: string;

  beforeAll(async () => {
    await fs.promises.mkdir(testFixturesDir, { recursive: true });
  });

  beforeEach(async () => {
    lspSymbolsTool = new LSPSymbolsTool();
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    tempDir = path.join(testFixturesDir, uniqueId);
    await fs.promises.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  afterAll(async () => {
    try {
      await fs.promises.rm(testFixturesDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('basic functionality', () => {
    it('should have correct name and description', () => {
      expect(lspSymbolsTool.name).toBe('lsp-symbols');
      expect(lspSymbolsTool.description).toContain('symbols');
    });

    it('should have required parameters', () => {
      const queryParam = lspSymbolsTool.parameters.find(p => p.name === 'query');
      expect(queryParam?.required).toBe(true);
    });

    it('should have optional parameters with defaults', () => {
      const symbolKindParam = lspSymbolsTool.parameters.find(p => p.name === 'symbolKind');
      const maxResultsParam = lspSymbolsTool.parameters.find(p => p.name === 'maxResults');
      const caseSensitiveParam = lspSymbolsTool.parameters.find(p => p.name === 'caseSensitive');

      expect(symbolKindParam?.defaultValue).toBe('all');
      expect(maxResultsParam?.defaultValue).toBe(50);
      expect(caseSensitiveParam?.defaultValue).toBe(false);
    });
  });

  describe('execute method validation', () => {
    it('should return error for missing query', async () => {
      const result = await lspSymbolsTool.execute({
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Query parameter is required');
    });

    it('should return error for empty query', async () => {
      const result = await lspSymbolsTool.execute({
        query: '',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Query parameter is required');
    });
  });

  describe('language detection', () => {
    it('should detect TypeScript files', () => {
      const tool = lspSymbolsTool as any;
      expect(tool.detectLanguage('test.ts')).toBe('typescript');
    });

    it('should detect Python files', () => {
      const tool = lspSymbolsTool as any;
      expect(tool.detectLanguage('script.py')).toBe('python');
    });

    it('should detect Go files', () => {
      const tool = lspSymbolsTool as any;
      expect(tool.detectLanguage('main.go')).toBe('go');
    });

    it('should detect Rust files', () => {
      const tool = lspSymbolsTool as any;
      expect(tool.detectLanguage('lib.rs')).toBe('rust');
    });
  });

  describe('JavaScript/TypeScript symbol extraction', () => {
    it('should find function declarations', async () => {
      const content = `function myFunction() {}`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspSymbolsTool.execute({
        query: 'myFunction',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbols?.length).toBeGreaterThanOrEqual(1);
      expect(result.data?.symbols?.[0]?.name).toBe('myFunction');
      expect(result.data?.symbols?.[0]?.kind).toBe('function');
    });

    it('should find class declarations', async () => {
      const content = `class MyClass {}`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspSymbolsTool.execute({
        query: 'MyClass',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbols?.[0]?.name).toBe('MyClass');
      expect(result.data?.symbols?.[0]?.kind).toBe('class');
    });

    it('should find interface declarations', async () => {
      const content = `interface MyInterface {}`;
      const testFile = path.join(tempDir, 'test.ts');
      await fs.promises.writeFile(testFile, content);

      const result = await lspSymbolsTool.execute({
        query: 'MyInterface',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbols?.[0]?.name).toBe('MyInterface');
      expect(result.data?.symbols?.[0]?.kind).toBe('interface');
    });

    it('should find type declarations', async () => {
      const content = `type MyType = string;`;
      const testFile = path.join(tempDir, 'test.ts');
      await fs.promises.writeFile(testFile, content);

      const result = await lspSymbolsTool.execute({
        query: 'MyType',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbols?.[0]?.name).toBe('MyType');
      expect(result.data?.symbols?.[0]?.kind).toBe('type');
    });

    it('should find const declarations', async () => {
      const content = `const myConst = 42;`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspSymbolsTool.execute({
        query: 'myConst',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbols?.[0]?.name).toBe('myConst');
      expect(result.data?.symbols?.[0]?.kind).toBe('variable');
    });

    it('should find arrow functions', async () => {
      const content = `const myArrow = () => {};`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspSymbolsTool.execute({
        query: 'myArrow',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbols?.[0]?.name).toBe('myArrow');
      expect(result.data?.symbols?.[0]?.kind).toBe('function');
    });
  });

  describe('Python symbol extraction', () => {
    it('should find function definitions', async () => {
      const content = `def my_function():
    pass`;
      const testFile = path.join(tempDir, 'test.py');
      await fs.promises.writeFile(testFile, content);

      const result = await lspSymbolsTool.execute({
        query: 'my_function',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbols?.[0]?.name).toBe('my_function');
      expect(result.data?.symbols?.[0]?.kind).toBe('function');
    });

    it('should find class definitions', async () => {
      const content = `class MyClass:
    pass`;
      const testFile = path.join(tempDir, 'test.py');
      await fs.promises.writeFile(testFile, content);

      const result = await lspSymbolsTool.execute({
        query: 'MyClass',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbols?.[0]?.name).toBe('MyClass');
      expect(result.data?.symbols?.[0]?.kind).toBe('class');
    });
  });

  describe('Go symbol extraction', () => {
    it('should find function definitions', async () => {
      const content = `func myFunction() {}`;
      const testFile = path.join(tempDir, 'test.go');
      await fs.promises.writeFile(testFile, content);

      const result = await lspSymbolsTool.execute({
        query: 'myFunction',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbols?.[0]?.name).toBe('myFunction');
      expect(result.data?.symbols?.[0]?.kind).toBe('function');
    });

    it('should find struct definitions', async () => {
      const content = `type MyStruct struct {}`;
      const testFile = path.join(tempDir, 'test.go');
      await fs.promises.writeFile(testFile, content);

      const result = await lspSymbolsTool.execute({
        query: 'MyStruct',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbols?.[0]?.name).toBe('MyStruct');
      expect(result.data?.symbols?.[0]?.kind).toBe('struct');
    });
  });

  describe('Rust symbol extraction', () => {
    it('should find function definitions', async () => {
      const content = `fn my_function() {}`;
      const testFile = path.join(tempDir, 'test.rs');
      await fs.promises.writeFile(testFile, content);

      const result = await lspSymbolsTool.execute({
        query: 'my_function',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbols?.[0]?.name).toBe('my_function');
      expect(result.data?.symbols?.[0]?.kind).toBe('function');
    });

    it('should find struct definitions', async () => {
      const content = `struct MyStruct {}`;
      const testFile = path.join(tempDir, 'test.rs');
      await fs.promises.writeFile(testFile, content);

      const result = await lspSymbolsTool.execute({
        query: 'MyStruct',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbols?.[0]?.name).toBe('MyStruct');
      expect(result.data?.symbols?.[0]?.kind).toBe('struct');
    });
  });

  describe('search options', () => {
    it('should filter by symbol kind', async () => {
      const content = `function myFunc() {}
class MyClass {}
const myConst = 42;`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspSymbolsTool.execute({
        query: 'my',
        symbolKind: 'function',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbols?.every((s: any) => s.kind === 'function')).toBe(true);
    });

    it('should support case-sensitive search', async () => {
      const content = `function MyFunction() {}
function myFunction() {}`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspSymbolsTool.execute({
        query: 'MyFunction',
        caseSensitive: true,
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbols?.length).toBe(1);
      expect(result.data?.symbols?.[0]?.name).toBe('MyFunction');
    });

    it('should support case-insensitive search', async () => {
      const content = `function MyFunction() {}
function myFunction() {}`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspSymbolsTool.execute({
        query: 'myfunction',
        caseSensitive: false,
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbols?.length).toBe(2);
    });

    it('should respect maxResults limit', async () => {
      let content = '';
      for (let i = 0; i < 20; i++) {
        content += `function test${i}() {}\n`;
      }
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspSymbolsTool.execute({
        query: 'test',
        maxResults: 5,
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.returned).toBeLessThanOrEqual(5);
    });
  });

  describe('grouping', () => {
    it('should group symbols by file', async () => {
      const content1 = `function test1() {}`;
      const content2 = `function test2() {}`;
      await fs.promises.writeFile(path.join(tempDir, 'file1.js'), content1);
      await fs.promises.writeFile(path.join(tempDir, 'file2.js'), content2);

      const result = await lspSymbolsTool.execute({
        query: 'test',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(Object.keys(result.data?.symbolsByFile || {}).length).toBe(2);
    });

    it('should group symbols by kind', async () => {
      const content = `function myFunc() {}
class MyClass {}`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspSymbolsTool.execute({
        query: 'my',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbolsByKind?.function).toBeDefined();
      expect(result.data?.symbolsByKind?.class).toBeDefined();
    });
  });

  describe('relevance sorting', () => {
    it('should prioritize exact matches', async () => {
      const content = `function test() {}
function testFunction() {}
function myTest() {}`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspSymbolsTool.execute({
        query: 'test',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbols?.[0]?.name).toBe('test');
    });

    it('should prioritize starts-with matches', async () => {
      const content = `function myTest() {}
function testFunction() {}`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspSymbolsTool.execute({
        query: 'test',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbols?.[0]?.name).toBe('testFunction');
    });
  });

  describe('context inclusion', () => {
    it('should include context when requested', async () => {
      const content = `// Comment before
function myFunction() {
  return 42;
}`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspSymbolsTool.execute({
        query: 'myFunction',
        includeContext: true,
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbols?.[0]?.context).toBeDefined();
      expect(result.data?.symbols?.[0]?.context?.lines?.length).toBeGreaterThanOrEqual(1);
    });

    it('should not include context when not requested', async () => {
      const content = `function myFunction() {}`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspSymbolsTool.execute({
        query: 'myFunction',
        includeContext: false,
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbols?.[0]?.context).toBeUndefined();
    });
  });

  describe('multi-file search', () => {
    it('should search across multiple files', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'file1.js'),
        'function searchTarget() {}'
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'file2.js'),
        'class SearchTarget {}'
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'file3.ts'),
        'interface SearchTarget {}'
      );

      const result = await lspSymbolsTool.execute({
        query: 'SearchTarget',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.totalFound).toBe(3);
    });

    it('should filter by language', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'file.js'),
        'function test() {}'
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'file.py'),
        'def test(): pass'
      );

      const result = await lspSymbolsTool.execute({
        query: 'test',
        language: 'javascript',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.totalFound).toBe(1);
    });
  });
});
