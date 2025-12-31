import { LSPDefinitionTool } from '../tools/LSPDefinitionTool.js';
import { LSPReferencesTool } from '../tools/LSPReferencesTool.js';
import { LSPRenameTool } from '../tools/LSPRenameTool.js';
import { LSPActionsTool } from '../tools/LSPActionsTool.js';
import { LSPSymbolsTool } from '../tools/LSPSymbolsTool.js';
import { LSPDiagnosticsTool } from '../tools/LSPDiagnosticsTool.js';
import { LSPHoverTool } from '../tools/LSPHoverTool.js';
import * as fs from 'fs';
import * as path from 'path';

// Use project directory for temp files to satisfy security manager
const projectRoot = process.cwd();
const testFixturesDir = path.join(projectRoot, 'src', '__tests__', '__fixtures__', 'lsp-integration-test');

describe('LSP Integration Tests', () => {
  let tempDir: string;

  // Tool instances
  let definitionTool: LSPDefinitionTool;
  let referencesTool: LSPReferencesTool;
  let renameTool: LSPRenameTool;
  let actionsTool: LSPActionsTool;
  let symbolsTool: LSPSymbolsTool;
  let diagnosticsTool: LSPDiagnosticsTool;
  let hoverTool: LSPHoverTool;

  beforeAll(async () => {
    await fs.promises.mkdir(testFixturesDir, { recursive: true });
  });

  beforeEach(async () => {
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    tempDir = path.join(testFixturesDir, uniqueId);
    await fs.promises.mkdir(tempDir, { recursive: true });

    // Initialize all tools
    definitionTool = new LSPDefinitionTool();
    referencesTool = new LSPReferencesTool();
    renameTool = new LSPRenameTool();
    actionsTool = new LSPActionsTool();
    symbolsTool = new LSPSymbolsTool();
    diagnosticsTool = new LSPDiagnosticsTool();
    hoverTool = new LSPHoverTool();
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

  describe('TypeScript/JavaScript project workflow', () => {
    beforeEach(async () => {
      // Create a sample TypeScript project
      const utilsContent = `/**
 * Utility functions for the project
 */

/**
 * Adds two numbers together
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Subtracts b from a
 */
export function subtract(a: number, b: number): number {
  return a - b;
}

export class Calculator {
  private value: number = 0;

  add(n: number): Calculator {
    this.value = add(this.value, n);
    return this;
  }

  subtract(n: number): Calculator {
    this.value = subtract(this.value, n);
    return this;
  }

  getValue(): number {
    return this.value;
  }
}
`;

      const mainContent = `import { add, subtract, Calculator } from './utils';

function main() {
  console.log(add(1, 2));
  console.log(subtract(5, 3));

  const calc = new Calculator();
  calc.add(10).subtract(5);
  console.log(calc.getValue());
}

main();
`;

      await fs.promises.writeFile(path.join(tempDir, 'utils.ts'), utilsContent);
      await fs.promises.writeFile(path.join(tempDir, 'main.ts'), mainContent);
    });

    it('should find definition of imported function', async () => {
      const result = await definitionTool.execute({
        file: path.join(tempDir, 'main.ts'),
        line: 4,
        character: 15, // position of 'add' in console.log(add(1, 2))
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbol).toBe('add');
      expect(result.data?.definition).toBeDefined();
      expect(result.data?.definition?.file).toContain('utils.ts');
    });

    it('should find all references to a function', async () => {
      const result = await referencesTool.execute({
        file: path.join(tempDir, 'utils.ts'),
        line: 8, // line with 'export function add'
        character: 17,
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbol).toBe('add');
      expect(result.data?.totalReferences).toBeGreaterThanOrEqual(2); // Declaration + usages
    });

    it('should find all symbols in workspace', async () => {
      const result = await symbolsTool.execute({
        query: 'add',
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.totalFound).toBeGreaterThanOrEqual(1);
      // Should find the 'add' function and the 'add' method in Calculator
      const symbols = result.data?.symbols || [];
      expect(symbols.some((s: any) => s.kind === 'function' && s.name === 'add')).toBe(true);
    });

    it('should get code actions for console.log removal', async () => {
      const result = await actionsTool.execute({
        file: path.join(tempDir, 'main.ts'),
        line: 4,
      });

      expect(result.success).toBe(true);
      const removeAction = result.data?.actions?.find(
        (a: any) => a.title === 'Remove console.log'
      );
      expect(removeAction).toBeDefined();
    });

    it('should rename function across files', async () => {
      const result = await renameTool.execute({
        file: path.join(tempDir, 'utils.ts'),
        line: 8,
        character: 17,
        newName: 'addNumbers',
        dryRun: true,
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.dryRun).toBe(true);
      expect(result.data?.totalEdits).toBeGreaterThanOrEqual(2);
      expect(result.data?.filesAffected).toBeGreaterThanOrEqual(1);
    });

    it('should get hover information for class', async () => {
      const result = await hoverTool.execute({
        file: path.join(tempDir, 'utils.ts'),
        line: 19,
        character: 14, // position of 'Calculator' in class declaration (line 19)
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbol).toBe('Calculator');
      expect(result.data?.type).toBe('class');
    });

    it('should get diagnostics for the project', async () => {
      const result = await diagnosticsTool.execute({
        files: [path.join(tempDir, 'main.ts'), path.join(tempDir, 'utils.ts')],
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.totalFiles).toBe(2);
      // Should find console.log diagnostics
      expect(result.data?.summary).toBeDefined();
    });
  });

  describe('Python project workflow', () => {
    beforeEach(async () => {
      const helperContent = `"""Helper module with utility functions"""

def calculate_sum(a, b):
    """Calculate the sum of two numbers"""
    return a + b

def calculate_product(a, b):
    """Calculate the product of two numbers"""
    return a * b

class MathOperations:
    """A class for mathematical operations"""

    def __init__(self):
        self.result = 0

    def add(self, value):
        """Add a value to the result"""
        self.result = calculate_sum(self.result, value)
        return self

    def multiply(self, value):
        """Multiply the result by a value"""
        self.result = calculate_product(self.result, value)
        return self
`;

      const mainContent = `from helper import calculate_sum, calculate_product, MathOperations

def main():
    print(calculate_sum(1, 2))
    print(calculate_product(3, 4))

    ops = MathOperations()
    ops.add(5).multiply(2)
    print(ops.result)

if __name__ == "__main__":
    main()
`;

      await fs.promises.writeFile(path.join(tempDir, 'helper.py'), helperContent);
      await fs.promises.writeFile(path.join(tempDir, 'main.py'), mainContent);
    });

    it('should find definition of Python function', async () => {
      const result = await definitionTool.execute({
        file: path.join(tempDir, 'main.py'),
        line: 4,
        character: 10, // position of 'calculate_sum'
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbol).toBe('calculate_sum');
    });

    it('should find references to Python function', async () => {
      const result = await referencesTool.execute({
        file: path.join(tempDir, 'helper.py'),
        line: 3,
        character: 5, // position of 'calculate_sum'
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbol).toBe('calculate_sum');
      expect(result.data?.totalReferences).toBeGreaterThanOrEqual(2);
    });

    it('should find Python symbols', async () => {
      const result = await symbolsTool.execute({
        query: 'calculate',
        workingDirectory: tempDir,
        language: 'python',
      });

      expect(result.success).toBe(true);
      expect(result.data?.totalFound).toBeGreaterThanOrEqual(2);
    });

    it('should suggest removing print statements in Python', async () => {
      const result = await actionsTool.execute({
        file: path.join(tempDir, 'main.py'),
        line: 4,
      });

      expect(result.success).toBe(true);
      const printAction = result.data?.actions?.find(
        (a: any) => a.title === 'Remove print statement'
      );
      expect(printAction).toBeDefined();
    });
  });

  describe('Go project workflow', () => {
    beforeEach(async () => {
      const mathContent = `package math

// Add adds two integers
func Add(a, b int) int {
    return a + b
}

// Subtract subtracts b from a
func Subtract(a, b int) int {
    return a - b
}

// Calculator provides mathematical operations
type Calculator struct {
    value int
}

// NewCalculator creates a new Calculator
func NewCalculator() *Calculator {
    return &Calculator{value: 0}
}

// Add adds a value to the calculator
func (c *Calculator) Add(n int) *Calculator {
    c.value = Add(c.value, n)
    return c
}

// GetValue returns the current value
func (c *Calculator) GetValue() int {
    return c.value
}
`;

      const mainContent = `package main

import (
    "fmt"
    "./math"
)

func main() {
    fmt.Println(math.Add(1, 2))

    calc := math.NewCalculator()
    calc.Add(10)
    fmt.Println(calc.GetValue())
}
`;

      await fs.promises.writeFile(path.join(tempDir, 'math.go'), mathContent);
      await fs.promises.writeFile(path.join(tempDir, 'main.go'), mainContent);
    });

    it('should find Go function definition', async () => {
      const result = await definitionTool.execute({
        file: path.join(tempDir, 'math.go'),
        line: 4,
        character: 6, // position of 'Add'
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbol).toBe('Add');
      expect(result.data?.definition?.kind).toBe('function');
    });

    it('should find Go struct definition', async () => {
      const result = await symbolsTool.execute({
        query: 'Calculator',
        workingDirectory: tempDir,
        language: 'go',
      });

      expect(result.success).toBe(true);
      const structSymbol = result.data?.symbols?.find(
        (s: any) => s.kind === 'struct' && s.name === 'Calculator'
      );
      expect(structSymbol).toBeDefined();
    });

    it('should suggest removing fmt.Println in Go', async () => {
      const result = await actionsTool.execute({
        file: path.join(tempDir, 'main.go'),
        line: 9,
      });

      expect(result.success).toBe(true);
      const printAction = result.data?.actions?.find(
        (a: any) => a.title === 'Remove fmt.Print statement'
      );
      expect(printAction).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle non-existent file gracefully', async () => {
      const result = await definitionTool.execute({
        file: path.join(tempDir, 'non-existent.ts'),
        line: 1,
        character: 0,
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle empty directory gracefully', async () => {
      const emptyDir = path.join(testFixturesDir, 'empty-' + Date.now());
      await fs.promises.mkdir(emptyDir, { recursive: true });

      const result = await symbolsTool.execute({
        query: 'test',
        workingDirectory: emptyDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.totalFound).toBe(0);

      await fs.promises.rm(emptyDir, { recursive: true, force: true });
    });

    it('should handle invalid position gracefully', async () => {
      const content = 'const x = 1;';
      const testFile = path.join(tempDir, 'test.ts');
      await fs.promises.writeFile(testFile, content);

      const result = await definitionTool.execute({
        file: testFile,
        line: 1000,
        character: 0,
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('beyond the end');
    });

    it('should handle permission errors gracefully', async () => {
      // Skip this test on Windows where permission handling is different
      if (process.platform === 'win32') {
        return;
      }

      const testFile = path.join(tempDir, 'readonly.ts');
      await fs.promises.writeFile(testFile, 'const x = 1;');
      await fs.promises.chmod(testFile, 0o000);

      try {
        const result = await definitionTool.execute({
          file: testFile,
          line: 1,
          character: 6,
          workingDirectory: tempDir,
        });

        // Should fail due to permission
        expect(result.success).toBe(false);
      } finally {
        // Restore permissions for cleanup
        await fs.promises.chmod(testFile, 0o644);
      }
    });
  });

  describe('Complex refactoring scenarios', () => {
    it('should handle renaming with name conflicts detection', async () => {
      const content = `function existingName() {}
function targetName() {}
targetName();
`;
      const testFile = path.join(tempDir, 'test.ts');
      await fs.promises.writeFile(testFile, content);

      const result = await renameTool.execute({
        file: testFile,
        line: 2,
        character: 10,
        newName: 'existingName', // Try to rename to an existing name
        dryRun: true,
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('conflict');
    });

    it('should find definitions across nested directories', async () => {
      // Create nested directory structure
      const srcDir = path.join(tempDir, 'src');
      const libDir = path.join(srcDir, 'lib');
      await fs.promises.mkdir(libDir, { recursive: true });

      const utilContent = `export function deepUtil() { return 42; }`;
      const mainContent = `import { deepUtil } from './lib/util';
console.log(deepUtil());
`;

      await fs.promises.writeFile(path.join(libDir, 'util.ts'), utilContent);
      await fs.promises.writeFile(path.join(srcDir, 'main.ts'), mainContent);

      const result = await definitionTool.execute({
        file: path.join(srcDir, 'main.ts'),
        line: 2,
        character: 13, // position of 'deepUtil'
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.symbol).toBe('deepUtil');
    });
  });

  describe('Tool interoperability', () => {
    it('should use symbols result for references search', async () => {
      const content = `function myUniqueFunction() {}
myUniqueFunction();
myUniqueFunction();
`;
      const testFile = path.join(tempDir, 'test.ts');
      await fs.promises.writeFile(testFile, content);

      // First find the symbol
      const symbolsResult = await symbolsTool.execute({
        query: 'myUniqueFunction',
        workingDirectory: tempDir,
      });

      expect(symbolsResult.success).toBe(true);
      const symbol = symbolsResult.data?.symbols?.[0];
      expect(symbol).toBeDefined();

      // Then find references using the symbol location
      const refsResult = await referencesTool.execute({
        file: symbol.file,
        line: symbol.range.start.line + 1, // Convert to 1-based
        character: symbol.range.start.character,
        workingDirectory: tempDir,
      });

      expect(refsResult.success).toBe(true);
      expect(refsResult.data?.totalReferences).toBe(3);
    });

    it('should use definition for hover information', async () => {
      const content = `/**
 * A documented function
 * @param x The input value
 * @returns The doubled value
 */
function doubleValue(x: number): number {
  return x * 2;
}

const result = doubleValue(5);
`;
      const testFile = path.join(tempDir, 'test.ts');
      await fs.promises.writeFile(testFile, content);

      // Find definition
      const defResult = await definitionTool.execute({
        file: testFile,
        line: 10,
        character: 15, // position of 'doubleValue' in usage
        workingDirectory: tempDir,
      });

      expect(defResult.success).toBe(true);

      // Get hover at definition location
      const hoverResult = await hoverTool.execute({
        file: testFile,
        line: defResult.data?.definition?.range?.start?.line + 1 || 6,
        character: 10,
      });

      expect(hoverResult.success).toBe(true);
      expect(hoverResult.data?.symbol).toBe('doubleValue');
      expect(hoverResult.data?.documentation).toContain('documented');
    });
  });
});
