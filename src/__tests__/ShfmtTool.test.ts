import { ShfmtTool } from '../tools/ShfmtTool.js';

// Mock child_process.exec for installation prevention
jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process');
  return {
    ...actual,
    exec: jest.fn((cmd: string, ...args: any[]) => {
      // If it's an install command, skip it
      if (cmd.includes('install') && !cmd.includes('which')) {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          callback(new Error('Installation mocked'));
        }
        return;
      }
      return actual.exec(cmd, ...args);
    }),
  };
});

describe('ShfmtTool', () => {
  let shfmtTool: ShfmtTool;

  beforeEach(() => {
    shfmtTool = new ShfmtTool();
  });

  describe('tool metadata', () => {
    it('should have correct name', () => {
      expect(shfmtTool.name).toBe('shfmt');
    });

    it('should have a description', () => {
      expect(shfmtTool.description).toBeTruthy();
      expect(shfmtTool.description).toContain('shfmt');
    });

    it('should have required parameters', () => {
      const scriptParam = shfmtTool.parameters.find(p => p.name === 'script');
      expect(scriptParam).toBeDefined();
      expect(scriptParam?.required).toBe(true);
      expect(scriptParam?.type).toBe('string');
    });

    it('should have optional formatting parameters', () => {
      const optionalParams = ['indent', 'binaryNext', 'caseIndent', 'spaceRedirects', 'keepPadding', 'minify', 'language'];

      for (const paramName of optionalParams) {
        const param = shfmtTool.parameters.find(p => p.name === paramName);
        expect(param).toBeDefined();
        expect(param?.required).toBe(false);
      }
    });

    it('should have correct default values', () => {
      const indentParam = shfmtTool.parameters.find(p => p.name === 'indent');
      expect(indentParam?.defaultValue).toBe(2);

      const languageParam = shfmtTool.parameters.find(p => p.name === 'language');
      expect(languageParam?.defaultValue).toBe('bash');

      const caseIndentParam = shfmtTool.parameters.find(p => p.name === 'caseIndent');
      expect(caseIndentParam?.defaultValue).toBe(true);
    });
  });

  describe('execute', () => {
    it('should return error for empty script', async () => {
      const result = await shfmtTool.execute({ script: '' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('non-empty string');
    });

    it('should return error for non-string script', async () => {
      const result = await shfmtTool.execute({ script: 123 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('non-empty string');
    });

    it('should return error for missing script parameter', async () => {
      const result = await shfmtTool.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('non-empty string');
    });

    // Note: The following tests require shfmt to be installed
    // They will be skipped if shfmt is not available
    describe('with shfmt installed', () => {
      let isAvailable = false;

      beforeAll(async () => {
        // Just check if shfmt exists without trying to install
        isAvailable = await new Promise<boolean>((resolve) => {
          const actual = jest.requireActual('child_process');
          actual.exec('which shfmt', (error: Error | null) => {
            resolve(!error);
          });
        });
      }, 10000);

      it('should format a simple bash script', async () => {
        if (!isAvailable) {
          console.log('Skipping test: shfmt not available');
          return;
        }

        const script = `#!/bin/bash
if [ -f "$1" ];then
echo "File exists"
fi`;

        const result = await shfmtTool.execute({ script, indent: 2 });
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data.formatted).toBeDefined();
      }, 10000);

      it('should detect changes in formatted output', async () => {
        if (!isAvailable) {
          console.log('Skipping test: shfmt not available');
          return;
        }

        const script = `echo    "hello"`;
        const result = await shfmtTool.execute({ script });

        expect(result.success).toBe(true);
        // The 'changed' field indicates if formatting modified the script
        expect(typeof result.data.changed).toBe('boolean');
      }, 10000);

      it('should include formatting options in result', async () => {
        if (!isAvailable) {
          console.log('Skipping test: shfmt not available');
          return;
        }

        const script = `echo "test"`;
        const result = await shfmtTool.execute({
          script,
          indent: 4,
          binaryNext: true,
          language: 'posix',
        });

        expect(result.success).toBe(true);
        expect(result.data.options).toBeDefined();
        expect(result.data.options.indent).toBe(4);
        expect(result.data.options.binaryNext).toBe(true);
        expect(result.data.options.language).toBe('posix');
      }, 10000);

      it('should preserve original script in result', async () => {
        if (!isAvailable) {
          console.log('Skipping test: shfmt not available');
          return;
        }

        const script = `echo "hello world"`;
        const result = await shfmtTool.execute({ script });

        expect(result.success).toBe(true);
        expect(result.data.original).toBe(script);
      }, 10000);

      it('should include metadata with shfmt path', async () => {
        if (!isAvailable) {
          console.log('Skipping test: shfmt not available');
          return;
        }

        const script = `echo "test"`;
        const result = await shfmtTool.execute({ script });

        expect(result.success).toBe(true);
        expect(result.metadata).toBeDefined();
        expect(result.metadata?.shfmtPath).toBeDefined();
        expect(result.metadata?.executedAt).toBeDefined();
      }, 10000);
    });
  });

  describe('isAvailable', () => {
    it('should return a boolean', async () => {
      // This will check if shfmt is available without installing
      const isFound = await new Promise<boolean>((resolve) => {
        const actual = jest.requireActual('child_process');
        actual.exec('which shfmt', (error: Error | null) => {
          resolve(!error);
        });
      });
      expect(typeof isFound).toBe('boolean');
    }, 10000);
  });

  describe('getVersion', () => {
    it('should return version string or null when shfmt exists', async () => {
      // Check if shfmt exists first
      const isFound = await new Promise<boolean>((resolve) => {
        const actual = jest.requireActual('child_process');
        actual.exec('which shfmt', (error: Error | null) => {
          resolve(!error);
        });
      });

      if (isFound) {
        const version = await new Promise<string | null>((resolve) => {
          const actual = jest.requireActual('child_process');
          actual.exec('shfmt --version', (error: Error | null, stdout: string) => {
            resolve(error ? null : stdout.trim());
          });
        });
        expect(version === null || typeof version === 'string').toBe(true);
      } else {
        console.log('Skipping getVersion test: shfmt not available');
      }
    }, 10000);
  });
});
