import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Tool, ToolParameter, ToolResult } from '../types/index.js';
import { cancellationManager } from '../utils/CancellationManager.js';

/**
 * Test execution tool
 * Detects and runs various test frameworks (Jest, Mocha, Vitest, etc.)
 * Provides test result parsing and watch mode support
 */
export class TestTool implements Tool {
  name = 'test';
  description =
    'Execute tests using various testing frameworks with result parsing and watch mode support';

  parameters: ToolParameter[] = [
    {
      name: 'framework',
      type: 'string',
      description: 'Test framework to use (auto-detect, jest, mocha, vitest, playwright)',
      required: false,
      defaultValue: 'auto-detect',
    },
    {
      name: 'pattern',
      type: 'string',
      description: 'Test file pattern or specific test file to run',
      required: false,
      defaultValue: '',
    },
    {
      name: 'watch',
      type: 'boolean',
      description: 'Enable watch mode for continuous testing',
      required: false,
      defaultValue: false,
    },
    {
      name: 'cwd',
      type: 'string',
      description: 'Working directory for test execution',
      required: false,
      defaultValue: process.cwd(),
    },
    {
      name: 'timeout',
      type: 'number',
      description: 'Test execution timeout in milliseconds',
      required: false,
      defaultValue: 300000, // 5 minutes
    },
    {
      name: 'verbose',
      type: 'boolean',
      description: 'Enable verbose output',
      required: false,
      defaultValue: false,
    },
  ];

  private readonly testFrameworks = {
    jest: {
      detect: ['jest', 'jest.config.js', 'jest.config.ts', 'jest.config.json'],
      commands: {
        run: ['npx', 'jest'],
        watch: ['npx', 'jest', '--watch'],
        pattern: (pattern: string) => ['npx', 'jest', pattern],
      },
    },
    mocha: {
      detect: ['mocha', 'mocha.opts'],
      commands: {
        run: ['npx', 'mocha'],
        watch: ['npx', 'mocha', '--watch'],
        pattern: (pattern: string) => ['npx', 'mocha', pattern],
      },
    },
    vitest: {
      detect: ['vitest', 'vitest.config.js', 'vitest.config.ts'],
      commands: {
        run: ['npx', 'vitest', 'run'],
        watch: ['npx', 'vitest'],
        pattern: (pattern: string) => ['npx', 'vitest', 'run', pattern],
      },
    },
    playwright: {
      detect: ['playwright', 'playwright.config.js', 'playwright.config.ts'],
      commands: {
        run: ['npx', 'playwright', 'test'],
        watch: ['npx', 'playwright', 'test', '--ui'],
        pattern: (pattern: string) => ['npx', 'playwright', 'test', pattern],
      },
    },
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const {
        framework = 'auto-detect',
        pattern = '',
        watch = false,
        cwd = process.cwd(),
        timeout = 300000,
        verbose = false,
      } = params;

      // Validate working directory
      if (!fs.existsSync(cwd)) {
        return {
          success: false,
          error: `Working directory does not exist: ${cwd}`,
        };
      }

      // Detect or validate test framework
      const detectedFramework =
        framework === 'auto-detect' ? await this.detectTestFramework(cwd) : framework;

      if (
        !detectedFramework ||
        !this.testFrameworks[detectedFramework as keyof typeof this.testFrameworks]
      ) {
        return {
          success: false,
          error: `Unsupported or undetected test framework: ${framework}. Supported: ${Object.keys(this.testFrameworks).join(', ')}`,
        };
      }

      const frameworkConfig =
        this.testFrameworks[detectedFramework as keyof typeof this.testFrameworks];

      // Build command
      let command: string[];
      if (watch) {
        command = frameworkConfig.commands.watch;
      } else if (pattern) {
        command = frameworkConfig.commands.pattern(pattern);
      } else {
        command = frameworkConfig.commands.run;
      }

      // Add verbose flag if requested
      if (verbose && detectedFramework === 'jest') {
        command.push('--verbose');
      }

      // Execute tests
      const result = await this.runTestCommand(command, cwd, timeout, watch);

      const toolResult: ToolResult = {
        success: result.success,
        data: {
          framework: detectedFramework,
          command: command.join(' '),
          output: result.output,
          exitCode: result.exitCode,
          executionTime: result.executionTime,
          parsedResults: this.parseTestResults(result.output, detectedFramework),
        },
        metadata: {
          watchMode: watch,
          workingDirectory: cwd,
          timeout,
        },
      };

      if (result.error) {
        toolResult.error = result.error;
      }

      return toolResult;
    } catch (error) {
      return {
        success: false,
        error: `Test execution failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async detectTestFramework(cwd: string): Promise<string | null> {
    for (const [framework, config] of Object.entries(this.testFrameworks)) {
      for (const detectFile of config.detect) {
        const filePath = path.join(cwd, detectFile);
        if (fs.existsSync(filePath)) {
          return framework;
        }

        // Also check package.json scripts
        const packageJsonPath = path.join(cwd, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            const scripts = packageJson.scripts || {};
            for (const script of Object.values(scripts) as string[]) {
              if (script.includes(framework)) {
                return framework;
              }
            }
          } catch (error) {
            // Ignore package.json parsing errors
          }
        }
      }
    }
    return null;
  }

  private async runTestCommand(
    command: string[],
    cwd: string,
    timeout: number,
    watch: boolean
  ): Promise<{
    success: boolean;
    output: string;
    exitCode: number;
    error?: string;
    executionTime: number;
  }> {
    return new Promise(resolve => {
      const startTime = Date.now();
      let output = '';
      let errorOutput = '';

      const child = child_process.spawn(command[0], command.slice(1), {
        cwd,
        stdio: watch ? 'inherit' : 'pipe',
        env: { ...process.env, FORCE_COLOR: '1' },
      });

      // Handle cancellation
      cancellationManager.registerProcess(child);

      if (!watch) {
        child.stdout?.on('data', data => {
          output += data.toString();
        });

        child.stderr?.on('data', data => {
          errorOutput += data.toString();
        });
      }

      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        const result: {
          success: boolean;
          output: string;
          exitCode: number;
          error?: string;
          executionTime: number;
        } = {
          success: false,
          output,
          exitCode: -1,
          error: `Test execution timed out after ${timeout}ms`,
          executionTime: Date.now() - startTime,
        };
        resolve(result);
      }, timeout);

      child.on('close', code => {
        clearTimeout(timeoutId);
        const executionTime = Date.now() - startTime;

        if (watch) {
          // Watch mode doesn't return results
          resolve({
            success: true,
            output: 'Watch mode started',
            exitCode: code || 0,
            executionTime,
          });
        } else {
          const fullOutput = output + (errorOutput ? '\nSTDERR:\n' + errorOutput : '');
          const result: {
            success: boolean;
            output: string;
            exitCode: number;
            error?: string;
            executionTime: number;
          } = {
            success: code === 0,
            output: fullOutput,
            exitCode: code || 0,
            executionTime,
          };
          if (code !== 0) {
            result.error = `Test command failed with exit code ${code}`;
          }
          resolve(result);
        }
      });

      child.on('error', error => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          output,
          exitCode: -1,
          error: `Failed to start test command: ${error.message}`,
          executionTime: Date.now() - startTime,
        } as {
          success: boolean;
          output: string;
          exitCode: number;
          error?: string;
          executionTime: number;
        });
      });
    });
  }

  private parseTestResults(output: string, framework: string): any {
    try {
      switch (framework) {
        case 'jest':
          return this.parseJestResults(output);
        case 'mocha':
          return this.parseMochaResults(output);
        case 'vitest':
          return this.parseVitestResults(output);
        case 'playwright':
          return this.parsePlaywrightResults(output);
        default:
          return { raw: output };
      }
    } catch (error) {
      return {
        parseError: error instanceof Error ? error.message : String(error),
        raw: output,
      };
    }
  }

  private parseJestResults(output: string): any {
    const results = {
      passed: 0,
      failed: 0,
      total: 0,
      duration: 0,
      testSuites: 0,
      snapshots: { passed: 0, failed: 0, total: 0 },
    };

    // Extract test results from Jest output
    const testResultsMatch = output.match(
      /Tests:\s*(\d+)\s*passed,\s*(\d+)\s*failed,\s*(\d+)\s*total/
    );
    if (testResultsMatch) {
      results.passed = parseInt(testResultsMatch[1]);
      results.failed = parseInt(testResultsMatch[2]);
      results.total = parseInt(testResultsMatch[3]);
    }

    const timeMatch = output.match(/Time:\s*([\d.]+)s/);
    if (timeMatch) {
      results.duration = parseFloat(timeMatch[1]);
    }

    return results;
  }

  private parseMochaResults(output: string): any {
    const results = {
      passed: 0,
      failed: 0,
      total: 0,
      duration: 0,
    };

    // Count passing tests
    const passingMatches = output.match(/✓/g);
    results.passed = passingMatches ? passingMatches.length : 0;

    // Count failing tests
    const failingMatches = output.match(/✗|×/g);
    results.failed = failingMatches ? failingMatches.length : 0;

    results.total = results.passed + results.failed;

    // Extract duration
    const durationMatch = output.match(/(\d+)\s*ms/);
    if (durationMatch) {
      results.duration = parseInt(durationMatch[1]) / 1000; // Convert to seconds
    }

    return results;
  }

  private parseVitestResults(output: string): any {
    // Similar to Jest parsing but adapted for Vitest
    return this.parseJestResults(output);
  }

  private parsePlaywrightResults(output: string): any {
    const results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      duration: 0,
    };

    // Extract test results from Playwright output
    const testResultsMatch = output.match(/(\d+)\s*passed\s*\((\d+)\s*ms\)/);
    if (testResultsMatch) {
      results.passed = parseInt(testResultsMatch[1]);
      results.duration = parseInt(testResultsMatch[2]) / 1000;
    }

    const failedMatch = output.match(/(\d+)\s*failed/);
    if (failedMatch) {
      results.failed = parseInt(failedMatch[1]);
    }

    const skippedMatch = output.match(/(\d+)\s*skipped/);
    if (skippedMatch) {
      results.skipped = parseInt(skippedMatch[1]);
    }

    results.total = results.passed + results.failed + results.skipped;

    return results;
  }
}
