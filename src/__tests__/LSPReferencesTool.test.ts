import { LSPReferencesTool } from '../tools/LSPReferencesTool.js';
import * as fs from 'fs';
import * as path from 'path';

// Use project directory for temp files to satisfy security manager
const projectRoot = process.cwd();
const testFixturesDir = path.join(projectRoot, 'src', '__tests__', '__fixtures__', 'lsp-ref-test');

describe('LSPReferencesTool', () => {
  let lspReferencesTool: LSPReferencesTool;
  let tempDir: string;

  beforeAll(async () => {
    await fs.promises.mkdir(testFixturesDir, { recursive: true });
  });

  beforeEach(async () => {
    lspReferencesTool = new LSPReferencesTool();
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
      expect(lspReferencesTool.name).toBe('lsp-references');
      expect(lspReferencesTool.description).toContain('references');
    });

    it('should have required parameters', () => {
      expect(lspReferencesTool.parameters).toHaveLength(8);

      const fileParam = lspReferencesTool.parameters.find(p => p.name === 'file');
      const lineParam = lspReferencesTool.parameters.find(p => p.name === 'line');
      const characterParam = lspReferencesTool.parameters.find(p => p.name === 'character');

      expect(fileParam?.required).toBe(true);
      expect(lineParam?.required).toBe(true);
      expect(characterParam?.required).toBe(true);
    });

    it('should have optional parameters with defaults', () => {
      const includeDeclarationParam = lspReferencesTool.parameters.find(
        p => p.name === 'includeDeclaration'
      );
      const maxResultsParam = lspReferencesTool.parameters.find(p => p.name === 'maxResults');

      expect(includeDeclarationParam?.defaultValue).toBe(true);
      expect(maxResultsParam?.defaultValue).toBe(100);
    });
  });

  describe('execute method validation', () => {
    it('should return error for missing file', async () => {
      const result = await lspReferencesTool.execute({
        line: 1,
        character: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('File parameter is required');
    });

    it('should return error for invalid line number', async () => {
      const result = await lspReferencesTool.execute({
        file: 'test.js',
        line: 0,
        character: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Line parameter is required');
    });
  });

  describe('language detection', () => {
    it('should detect TypeScript files', () => {
      const tool = lspReferencesTool as any;
      expect(tool.detectLanguage('test.ts')).toBe('typescript');
    });

    it('should detect Python files', () => {
      const tool = lspReferencesTool as any;
      expect(tool.detectLanguage('script.py')).toBe('python');
    });

    it('should detect Go files', () => {
      const tool = lspReferencesTool as any;
      expect(tool.detectLanguage('main.go')).toBe('go');
    });
  });

  describe('reference finding', () => {
    it('should find references in the same file', async () => {
      const content = `
function myFunction(a, b) {
  return a + b;
}

const result1 = myFunction(1, 2);
const result2 = myFunction(3, 4);
const result3 = myFunction(5, 6);
`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspReferencesTool.execute({
        file: testFile,
        line: 2,
        character: 10,
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbol).toBe('myFunction');
      expect(result.data?.totalReferences).toBeGreaterThanOrEqual(4); // Declaration + 3 usages
    });

    it('should exclude declaration when requested', async () => {
      const content = `
function myFunction(a, b) {
  return a + b;
}

const result = myFunction(1, 2);
`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspReferencesTool.execute({
        file: testFile,
        line: 6,
        character: 16,
        includeDeclaration: false,
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      // Should find the call but not the declaration
      expect(result.data?.references?.length).toBeGreaterThanOrEqual(1);
    });

    it('should find references across multiple files', async () => {
      // Create main file
      const mainContent = `
import { helper } from './helper';

function main() {
  return helper(1, 2);
}
`;
      await fs.promises.writeFile(path.join(tempDir, 'main.js'), mainContent);

      // Create helper file
      const helperContent = `
export function helper(a, b) {
  return a + b;
}
`;
      await fs.promises.writeFile(path.join(tempDir, 'helper.js'), helperContent);

      const result = await lspReferencesTool.execute({
        file: path.join(tempDir, 'helper.js'),
        line: 2,
        character: 17,
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbol).toBe('helper');
      // Should find references in both files
      expect(Object.keys(result.data?.referencesByFile || {}).length).toBeGreaterThanOrEqual(1);
    });

    it('should include context when requested', async () => {
      const content = `
function myFunction() {}
myFunction();
`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspReferencesTool.execute({
        file: testFile,
        line: 2,
        character: 10,
        includeContext: true,
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.references?.[0]?.context).toBeDefined();
    });

    it('should respect maxResults limit', async () => {
      let content = 'function test() {}\n';
      for (let i = 0; i < 20; i++) {
        content += `test();\n`;
      }
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspReferencesTool.execute({
        file: testFile,
        line: 1,
        character: 10,
        maxResults: 5,
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.returnedReferences).toBeLessThanOrEqual(5);
    });
  });

  describe('reference kinds', () => {
    it('should identify import references', async () => {
      const content = `
import { myFunction } from './module';
`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const tool = lspReferencesTool as any;
      const kind = tool.getReferenceKind(
        content.split('\n'),
        1,
        9,
        'myFunction',
        'javascript'
      );

      expect(kind).toBe('import');
    });

    it('should identify call references', async () => {
      const content = `myFunction();`;
      const tool = lspReferencesTool as any;
      const kind = tool.getReferenceKind(
        [content],
        0,
        0,
        'myFunction',
        'javascript'
      );

      expect(kind).toBe('call');
    });

    it('should identify declaration references', async () => {
      const content = `function myFunction() {}`;
      const tool = lspReferencesTool as any;
      const kind = tool.getReferenceKind(
        [content],
        0,
        9,
        'myFunction',
        'javascript'
      );

      expect(kind).toBe('declaration');
    });
  });

  describe('edge cases', () => {
    it('should return message when no symbol at position', async () => {
      const content = '   ';
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspReferencesTool.execute({
        file: testFile,
        line: 1,
        character: 1,
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.message).toContain('No symbol found');
    });

    it('should skip comments when searching for references', async () => {
      const content = `
function test() {}
// test is a function
test();
`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspReferencesTool.execute({
        file: testFile,
        line: 2,
        character: 10,
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      // Should not include the comment as a reference
      const commentRefs = result.data?.references?.filter(
        (r: any) => r.preview.includes('//')
      );
      expect(commentRefs?.length || 0).toBe(0);
    });
  });
});
