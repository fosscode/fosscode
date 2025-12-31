import { LSPActionsTool } from '../tools/LSPActionsTool.js';
import * as fs from 'fs';
import * as path from 'path';

// Use project directory for temp files to satisfy security manager
const projectRoot = process.cwd();
const testFixturesDir = path.join(projectRoot, 'src', '__tests__', '__fixtures__', 'lsp-actions-test');

describe('LSPActionsTool', () => {
  let lspActionsTool: LSPActionsTool;
  let tempDir: string;

  beforeAll(async () => {
    await fs.promises.mkdir(testFixturesDir, { recursive: true });
  });

  beforeEach(async () => {
    lspActionsTool = new LSPActionsTool();
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
      expect(lspActionsTool.name).toBe('lsp-actions');
      expect(lspActionsTool.description).toContain('code actions');
    });

    it('should have required parameters', () => {
      const fileParam = lspActionsTool.parameters.find(p => p.name === 'file');
      expect(fileParam?.required).toBe(true);
    });

    it('should have optional parameters', () => {
      const lineParam = lspActionsTool.parameters.find(p => p.name === 'line');
      const actionKindParam = lspActionsTool.parameters.find(p => p.name === 'actionKind');

      expect(lineParam?.required).toBe(false);
      expect(actionKindParam?.defaultValue).toBe('all');
    });
  });

  describe('execute method validation', () => {
    it('should return error for missing file', async () => {
      const result = await lspActionsTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('File parameter is required');
    });

    it('should return error for empty file', async () => {
      const result = await lspActionsTool.execute({
        file: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('File parameter is required');
    });
  });

  describe('language detection', () => {
    it('should detect TypeScript files', () => {
      const tool = lspActionsTool as any;
      expect(tool.detectLanguage('test.ts')).toBe('typescript');
    });

    it('should detect Python files', () => {
      const tool = lspActionsTool as any;
      expect(tool.detectLanguage('script.py')).toBe('python');
    });

    it('should detect Go files', () => {
      const tool = lspActionsTool as any;
      expect(tool.detectLanguage('main.go')).toBe('go');
    });
  });

  describe('JavaScript/TypeScript actions', () => {
    it('should suggest removing console.log', async () => {
      const content = `console.log("debug");`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspActionsTool.execute({
        file: testFile,
        line: 1,
      });

      expect(result.success).toBe(true);
      const removeAction = result.data?.actions?.find(
        (a: any) => a.title === 'Remove console.log'
      );
      expect(removeAction).toBeDefined();
      expect(removeAction?.kind).toBe('quickfix');
    });

    it('should suggest converting var to const/let', async () => {
      const content = `var myVariable = 42;`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspActionsTool.execute({
        file: testFile,
        line: 1,
      });

      expect(result.success).toBe(true);
      const constAction = result.data?.actions?.find(
        (a: any) => a.title === 'Convert var to const'
      );
      const letAction = result.data?.actions?.find((a: any) => a.title === 'Convert var to let');
      expect(constAction).toBeDefined();
      expect(letAction).toBeDefined();
      expect(constAction?.kind).toBe('refactor');
    });

    it('should suggest converting function to arrow function', async () => {
      const content = `function myFunction() {}`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspActionsTool.execute({
        file: testFile,
        line: 1,
      });

      expect(result.success).toBe(true);
      const arrowAction = result.data?.actions?.find(
        (a: any) => a.title === 'Convert to arrow function'
      );
      expect(arrowAction).toBeDefined();
    });

    it('should suggest adding semicolon', async () => {
      const content = `const x = 42`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspActionsTool.execute({
        file: testFile,
        line: 1,
      });

      expect(result.success).toBe(true);
      const semicolonAction = result.data?.actions?.find(
        (a: any) => a.title === 'Add semicolon'
      );
      expect(semicolonAction).toBeDefined();
    });

    it('should suggest extracting to constant', async () => {
      const content = `const msg = "This is a very long string that should be extracted";`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspActionsTool.execute({
        file: testFile,
        line: 1,
      });

      expect(result.success).toBe(true);
      const extractAction = result.data?.actions?.find(
        (a: any) => a.title === 'Extract to constant'
      );
      expect(extractAction).toBeDefined();
    });
  });

  describe('Python actions', () => {
    it('should suggest removing print statement', async () => {
      const content = `print("debug")`;
      const testFile = path.join(tempDir, 'test.py');
      await fs.promises.writeFile(testFile, content);

      const result = await lspActionsTool.execute({
        file: testFile,
        line: 1,
      });

      expect(result.success).toBe(true);
      const removeAction = result.data?.actions?.find(
        (a: any) => a.title === 'Remove print statement'
      );
      expect(removeAction).toBeDefined();
    });

    it('should suggest converting print to logging', async () => {
      const content = `print("info")`;
      const testFile = path.join(tempDir, 'test.py');
      await fs.promises.writeFile(testFile, content);

      const result = await lspActionsTool.execute({
        file: testFile,
        line: 1,
      });

      expect(result.success).toBe(true);
      const loggingAction = result.data?.actions?.find(
        (a: any) => a.title === 'Convert print to logging'
      );
      expect(loggingAction).toBeDefined();
    });

    it('should suggest adding return type hint', async () => {
      const content = `def my_function():
    pass`;
      const testFile = path.join(tempDir, 'test.py');
      await fs.promises.writeFile(testFile, content);

      const result = await lspActionsTool.execute({
        file: testFile,
        line: 1,
      });

      expect(result.success).toBe(true);
      const typeHintAction = result.data?.actions?.find(
        (a: any) => a.title === 'Add return type hint'
      );
      expect(typeHintAction).toBeDefined();
    });
  });

  describe('Go actions', () => {
    it('should suggest removing fmt.Println', async () => {
      const content = `fmt.Println("debug")`;
      const testFile = path.join(tempDir, 'test.go');
      await fs.promises.writeFile(testFile, content);

      const result = await lspActionsTool.execute({
        file: testFile,
        line: 1,
      });

      expect(result.success).toBe(true);
      const removeAction = result.data?.actions?.find(
        (a: any) => a.title === 'Remove fmt.Print statement'
      );
      expect(removeAction).toBeDefined();
    });
  });

  describe('action kind filtering', () => {
    it('should filter by quickfix kind', async () => {
      const content = `console.log("debug");
var myVar = 42;`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspActionsTool.execute({
        file: testFile,
        actionKind: 'quickfix',
      });

      expect(result.success).toBe(true);
      const allQuickfixes = result.data?.actions?.every(
        (a: any) => a.kind === 'quickfix'
      );
      expect(allQuickfixes).toBe(true);
    });

    it('should filter by refactor kind', async () => {
      const content = `var myVar = 42;`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspActionsTool.execute({
        file: testFile,
        actionKind: 'refactor',
      });

      expect(result.success).toBe(true);
      const allRefactors = result.data?.actions?.every((a: any) => a.kind === 'refactor');
      expect(allRefactors).toBe(true);
    });
  });

  describe('apply action', () => {
    it('should apply delete action', async () => {
      const content = `console.log("debug");`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspActionsTool.execute({
        file: testFile,
        line: 1,
        applyAction: 'Remove console.log',
      });

      expect(result.success).toBe(true);
      expect(result.data?.applied).toBe(true);

      const fileContent = await fs.promises.readFile(testFile, 'utf-8');
      expect(fileContent.trim()).toBe('');
    });

    it('should apply replace action', async () => {
      const content = `var myVar = 42;`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspActionsTool.execute({
        file: testFile,
        line: 1,
        applyAction: 'Convert var to const',
      });

      expect(result.success).toBe(true);
      expect(result.data?.applied).toBe(true);

      const fileContent = await fs.promises.readFile(testFile, 'utf-8');
      expect(fileContent).toContain('const');
      expect(fileContent).not.toContain('var');
    });

    it('should return error for non-existent action', async () => {
      const content = `const x = 42;`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspActionsTool.execute({
        file: testFile,
        line: 1,
        applyAction: 'Non-existent action',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('grouping actions', () => {
    it('should group actions by kind', async () => {
      const content = `console.log("debug");
var myVar = 42;`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspActionsTool.execute({
        file: testFile,
      });

      expect(result.success).toBe(true);
      expect(result.data?.actionsByKind).toBeDefined();
      expect(result.data?.actionsByKind?.quickfix).toBeDefined();
      expect(result.data?.actionsByKind?.refactor).toBeDefined();
    });
  });

  describe('range selection', () => {
    it('should get actions for specific line', async () => {
      const content = `const x = 1;
console.log("debug");
const y = 2;`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspActionsTool.execute({
        file: testFile,
        line: 2,
      });

      expect(result.success).toBe(true);
      const consoleAction = result.data?.actions?.find(
        (a: any) => a.title === 'Remove console.log'
      );
      expect(consoleAction).toBeDefined();
    });

    it('should get actions for line range', async () => {
      const content = `console.log("1");
console.log("2");
console.log("3");`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspActionsTool.execute({
        file: testFile,
        startLine: 1,
        endLine: 3,
      });

      expect(result.success).toBe(true);
      const consoleActions = result.data?.actions?.filter(
        (a: any) => a.title === 'Remove console.log'
      );
      expect(consoleActions?.length).toBe(3);
    });
  });
});
