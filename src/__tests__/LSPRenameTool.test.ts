import { LSPRenameTool } from '../tools/LSPRenameTool.js';
import * as fs from 'fs';
import * as path from 'path';

// Use project directory for temp files to satisfy security manager
const projectRoot = process.cwd();
const testFixturesDir = path.join(projectRoot, 'src', '__tests__', '__fixtures__', 'lsp-rename-test');

describe('LSPRenameTool', () => {
  let lspRenameTool: LSPRenameTool;
  let tempDir: string;

  beforeAll(async () => {
    await fs.promises.mkdir(testFixturesDir, { recursive: true });
  });

  beforeEach(async () => {
    lspRenameTool = new LSPRenameTool();
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
      expect(lspRenameTool.name).toBe('lsp-rename');
      expect(lspRenameTool.description).toContain('Rename');
    });

    it('should have required parameters', () => {
      expect(lspRenameTool.parameters).toHaveLength(8);

      const fileParam = lspRenameTool.parameters.find(p => p.name === 'file');
      const lineParam = lspRenameTool.parameters.find(p => p.name === 'line');
      const characterParam = lspRenameTool.parameters.find(p => p.name === 'character');
      const newNameParam = lspRenameTool.parameters.find(p => p.name === 'newName');

      expect(fileParam?.required).toBe(true);
      expect(lineParam?.required).toBe(true);
      expect(characterParam?.required).toBe(true);
      expect(newNameParam?.required).toBe(true);
    });

    it('should have optional parameters with defaults', () => {
      const dryRunParam = lspRenameTool.parameters.find(p => p.name === 'dryRun');
      const includeCommentsParam = lspRenameTool.parameters.find(p => p.name === 'includeComments');

      expect(dryRunParam?.defaultValue).toBe(false);
      expect(includeCommentsParam?.defaultValue).toBe(false);
    });
  });

  describe('execute method validation', () => {
    it('should return error for missing file', async () => {
      const result = await lspRenameTool.execute({
        line: 1,
        character: 0,
        newName: 'newName',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('File parameter is required');
    });

    it('should return error for missing newName', async () => {
      const result = await lspRenameTool.execute({
        file: 'test.js',
        line: 1,
        character: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('newName parameter is required');
    });

    it('should return error for invalid identifier', async () => {
      const result = await lspRenameTool.execute({
        file: 'test.js',
        line: 1,
        character: 0,
        newName: '123invalid',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid identifier');
    });

    it('should accept valid identifiers', () => {
      const tool = lspRenameTool as any;
      expect(tool.isValidIdentifier('validName')).toBe(true);
      expect(tool.isValidIdentifier('_valid')).toBe(true);
      expect(tool.isValidIdentifier('$valid')).toBe(true);
      expect(tool.isValidIdentifier('valid123')).toBe(true);
    });

    it('should reject invalid identifiers', () => {
      const tool = lspRenameTool as any;
      expect(tool.isValidIdentifier('123invalid')).toBe(false);
      expect(tool.isValidIdentifier('invalid-name')).toBe(false);
      expect(tool.isValidIdentifier('invalid name')).toBe(false);
    });
  });

  describe('dry run mode', () => {
    it('should preview changes without applying them', async () => {
      const content = `
function oldName() {}
oldName();
oldName();
`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspRenameTool.execute({
        file: testFile,
        line: 2,
        character: 10,
        newName: 'newName',
        dryRun: true,
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.dryRun).toBe(true);
      expect(result.data?.totalEdits).toBeGreaterThanOrEqual(3);

      // Verify file was not modified
      const fileContent = await fs.promises.readFile(testFile, 'utf-8');
      expect(fileContent).toContain('oldName');
      expect(fileContent).not.toContain('newName');
    });
  });

  describe('actual rename', () => {
    it('should rename symbol in the same file', async () => {
      const content = `function oldName() {}
oldName();
const x = oldName();
`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspRenameTool.execute({
        file: testFile,
        line: 1,
        character: 10,
        newName: 'newName',
        dryRun: false,
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.totalEdits).toBeGreaterThanOrEqual(3);

      // Verify file was modified
      const fileContent = await fs.promises.readFile(testFile, 'utf-8');
      expect(fileContent).not.toContain('oldName');
      expect(fileContent).toContain('newName');
    });

    it('should rename symbol across multiple files', async () => {
      // Create main file
      const mainContent = `import { helper } from './helper';
const result = helper(1, 2);
`;
      await fs.promises.writeFile(path.join(tempDir, 'main.js'), mainContent);

      // Create helper file
      const helperContent = `export function helper(a, b) {
  return a + b;
}
`;
      await fs.promises.writeFile(path.join(tempDir, 'helper.js'), helperContent);

      const result = await lspRenameTool.execute({
        file: path.join(tempDir, 'helper.js'),
        line: 1,
        character: 17,
        newName: 'newHelper',
        dryRun: false,
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);

      // Verify both files were modified
      const mainFileContent = await fs.promises.readFile(path.join(tempDir, 'main.js'), 'utf-8');
      const helperFileContent = await fs.promises.readFile(
        path.join(tempDir, 'helper.js'),
        'utf-8'
      );

      expect(mainFileContent).toContain('newHelper');
      expect(helperFileContent).toContain('newHelper');
    });

    it('should not rename when old and new names are the same', async () => {
      const content = 'function sameName() {}';
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspRenameTool.execute({
        file: testFile,
        line: 1,
        character: 10,
        newName: 'sameName',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.message).toContain('already has the new name');
    });
  });

  describe('skip strings and comments', () => {
    it('should not rename occurrences in comments by default', async () => {
      const content = `function myFunc() {}
// myFunc is a function
myFunc();
`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspRenameTool.execute({
        file: testFile,
        line: 1,
        character: 10,
        newName: 'newFunc',
        includeComments: false,
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);

      const fileContent = await fs.promises.readFile(testFile, 'utf-8');
      expect(fileContent).toContain('// myFunc is a function'); // Comment unchanged
      expect(fileContent).toContain('newFunc();'); // Code changed
    });

    it('should rename occurrences in comments when requested', async () => {
      const content = `function myFunc() {}
// myFunc is a function
myFunc();
`;
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspRenameTool.execute({
        file: testFile,
        line: 1,
        character: 10,
        newName: 'newFunc',
        includeComments: true,
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);

      const fileContent = await fs.promises.readFile(testFile, 'utf-8');
      expect(fileContent).toContain('// newFunc is a function'); // Comment changed
      expect(fileContent).toContain('newFunc();'); // Code changed
    });
  });

  describe('edge cases', () => {
    it('should return error when no symbol at position', async () => {
      const content = '   ';
      const testFile = path.join(tempDir, 'test.js');
      await fs.promises.writeFile(testFile, content);

      const result = await lspRenameTool.execute({
        file: testFile,
        line: 1,
        character: 1,
        newName: 'newName',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No symbol found');
    });

    it('should handle Python files', async () => {
      const content = `def my_function():
    pass

my_function()
`;
      const testFile = path.join(tempDir, 'test.py');
      await fs.promises.writeFile(testFile, content);

      const result = await lspRenameTool.execute({
        file: testFile,
        line: 1,
        character: 5,
        newName: 'new_function',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);

      const fileContent = await fs.promises.readFile(testFile, 'utf-8');
      expect(fileContent).toContain('new_function');
      expect(fileContent).not.toContain('my_function');
    });
  });
});
