import { TestTool } from '../tools/TestTool';

describe('TestTool', () => {
  let testTool: TestTool;

  beforeEach(() => {
    testTool = new TestTool();
  });

  describe('basic functionality', () => {
    it('should have correct name and description', () => {
      expect(testTool.name).toBe('test');
      expect(testTool.description).toContain('Execute tests using various testing frameworks');
    });

    it('should have required parameters', () => {
      expect(testTool.parameters).toHaveLength(6);
      const frameworkParam = testTool.parameters.find(p => p.name === 'framework');
      expect(frameworkParam?.required).toBe(false);
      expect(frameworkParam?.defaultValue).toBe('auto-detect');
    });
  });

  describe('execute method', () => {
    it('should return error for unsupported framework', async () => {
      const result = await testTool.execute({ framework: 'unsupported-framework' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported or undetected test framework');
    });

    it('should return error for invalid working directory', async () => {
      const result = await testTool.execute({ cwd: '/nonexistent/directory' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Working directory does not exist');
    });

    it('should handle auto-detection when no framework files exist', async () => {
      // Create a temporary directory for testing
      const tempDir = '/tmp/test-tool-test';
      const fs = require('fs');

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const result = await testTool.execute({ cwd: tempDir });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported or undetected test framework');

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('framework detection', () => {
    it('should detect Jest framework', async () => {
      const tool = new TestTool() as any;
      // Test the private method by accessing it
      const fs = require('fs');
      const path = require('path');

      // Mock fs.existsSync and fs.readFileSync
      const originalExistsSync = fs.existsSync;
      const originalReadFileSync = fs.readFileSync;

      fs.existsSync = jest.fn(filePath => {
        return path.basename(filePath) === 'jest.config.js';
      });

      const result = await tool.detectTestFramework('/test/dir');
      expect(result).toBe('jest');

      // Restore original functions
      fs.existsSync = originalExistsSync;
      fs.readFileSync = originalReadFileSync;
    });
  });

  describe('test result parsing', () => {
    it('should parse Jest test results', () => {
      const tool = new TestTool() as any;
      const jestOutput = `
Tests:       5 passed, 2 failed, 7 total
Snapshots:   3 passed, 1 failed, 4 total
Time:        3.2s
      `;

      const result = tool.parseTestResults(jestOutput, 'jest');
      expect(result.passed).toBe(5);
      expect(result.failed).toBe(2);
      expect(result.total).toBe(7);
      expect(result.duration).toBe(3.2);
    });

    it('should parse Mocha test results', () => {
      const tool = new TestTool() as any;
      const mochaOutput = `
✓ Test 1
✓ Test 2
✗ Test 3
✓ Test 4
✓ Test 5
4 passing (2.1s)
1 failing
      `;

      const result = tool.parseTestResults(mochaOutput, 'mocha');
      expect(result.passed).toBe(4);
      expect(result.failed).toBe(1);
      expect(result.total).toBe(5);
    });

    it('should handle unknown framework', () => {
      const tool = new TestTool() as any;
      const result = tool.parseTestResults('some output', 'unknown');
      expect(result).toHaveProperty('raw');
      expect(result.raw).toBe('some output');
    });
  });
});
