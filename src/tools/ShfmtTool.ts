import * as child_process from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Tool, ToolParameter, ToolResult } from '../types/index.js';

/**
 * Shell script formatter tool using shfmt
 * Formats shell scripts before execution or on demand
 */
export class ShfmtTool implements Tool {
  name = 'shfmt';
  description = 'Format shell scripts using shfmt. Auto-installs shfmt if not present.';

  private shfmtPath: string | null = null;
  private installAttempted = false;

  parameters: ToolParameter[] = [
    {
      name: 'script',
      type: 'string',
      description: 'The shell script content to format',
      required: true,
    },
    {
      name: 'indent',
      type: 'number',
      description: 'Indentation size (default: 2)',
      required: false,
      defaultValue: 2,
    },
    {
      name: 'binaryNext',
      type: 'boolean',
      description: 'Binary operators may start a line (default: false)',
      required: false,
      defaultValue: false,
    },
    {
      name: 'caseIndent',
      type: 'boolean',
      description: 'Indent case statements (default: true)',
      required: false,
      defaultValue: true,
    },
    {
      name: 'spaceRedirects',
      type: 'boolean',
      description: 'Add space after redirect operators (default: false)',
      required: false,
      defaultValue: false,
    },
    {
      name: 'keepPadding',
      type: 'boolean',
      description: 'Keep column alignment padding (default: false)',
      required: false,
      defaultValue: false,
    },
    {
      name: 'minify',
      type: 'boolean',
      description: 'Minify the script (default: false)',
      required: false,
      defaultValue: false,
    },
    {
      name: 'language',
      type: 'string',
      description: 'Shell language variant: bash, posix, mksh, bats (default: bash)',
      required: false,
      defaultValue: 'bash',
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const {
        script,
        indent = 2,
        binaryNext = false,
        caseIndent = true,
        spaceRedirects = false,
        keepPadding = false,
        minify = false,
        language = 'bash',
      } = params;

      if (!script || typeof script !== 'string') {
        throw new Error('Script must be a non-empty string');
      }

      // Ensure shfmt is available
      const shfmtPath = await this.ensureShfmt();
      if (!shfmtPath) {
        throw new Error('shfmt is not available and could not be installed');
      }

      // Build shfmt arguments
      const args = this.buildArgs({
        indent,
        binaryNext,
        caseIndent,
        spaceRedirects,
        keepPadding,
        minify,
        language,
      });

      // Format the script
      const formatted = await this.formatScript(shfmtPath, script, args);

      return {
        success: true,
        data: {
          original: script,
          formatted,
          changed: script !== formatted,
          options: {
            indent,
            binaryNext,
            caseIndent,
            spaceRedirects,
            keepPadding,
            minify,
            language,
          },
        },
        metadata: {
          executedAt: new Date().toISOString(),
          shfmtPath,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Build shfmt command arguments
   */
  private buildArgs(options: {
    indent: number;
    binaryNext: boolean;
    caseIndent: boolean;
    spaceRedirects: boolean;
    keepPadding: boolean;
    minify: boolean;
    language: string;
  }): string[] {
    const args: string[] = [];

    // Indentation
    args.push('-i', String(options.indent));

    // Language variant
    args.push('-ln', options.language);

    // Binary operators at line start
    if (options.binaryNext) {
      args.push('-bn');
    }

    // Case indent
    if (options.caseIndent) {
      args.push('-ci');
    }

    // Space after redirects
    if (options.spaceRedirects) {
      args.push('-sr');
    }

    // Keep padding
    if (options.keepPadding) {
      args.push('-kp');
    }

    // Minify
    if (options.minify) {
      args.push('-mn');
    }

    return args;
  }

  /**
   * Format a shell script using shfmt
   */
  private formatScript(shfmtPath: string, script: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = child_process.spawn(shfmtPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`shfmt failed: ${stderr || 'Unknown error'}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Failed to run shfmt: ${error.message}`));
      });

      // Write script to stdin
      child.stdin.write(script);
      child.stdin.end();
    });
  }

  /**
   * Ensure shfmt is available, installing if necessary
   */
  async ensureShfmt(): Promise<string | null> {
    // Check if we already found it
    if (this.shfmtPath) {
      return this.shfmtPath;
    }

    // Try to find shfmt in PATH
    const foundPath = await this.findShfmt();
    if (foundPath) {
      this.shfmtPath = foundPath;
      return foundPath;
    }

    // Try to install if not already attempted
    if (!this.installAttempted) {
      this.installAttempted = true;
      const installed = await this.installShfmt();
      if (installed) {
        this.shfmtPath = installed;
        return installed;
      }
    }

    return null;
  }

  /**
   * Find shfmt in PATH or common locations
   */
  private findShfmt(): Promise<string | null> {
    return new Promise((resolve) => {
      const command = process.platform === 'win32' ? 'where' : 'which';

      child_process.exec(`${command} shfmt`, (error, stdout) => {
        if (!error && stdout.trim()) {
          resolve(stdout.trim().split('\n')[0]);
          return;
        }

        // Check common installation paths
        const commonPaths = [
          path.join(os.homedir(), 'go', 'bin', 'shfmt'),
          path.join(os.homedir(), '.local', 'bin', 'shfmt'),
          '/usr/local/bin/shfmt',
          '/usr/bin/shfmt',
          '/opt/homebrew/bin/shfmt',
        ];

        for (const p of commonPaths) {
          if (fs.existsSync(p)) {
            resolve(p);
            return;
          }
        }

        resolve(null);
      });
    });
  }

  /**
   * Attempt to install shfmt
   */
  private async installShfmt(): Promise<string | null> {
    console.log('🔧 shfmt not found. Attempting to install...');

    const installMethods = this.getInstallMethods();

    for (const method of installMethods) {
      try {
        const result = await this.runInstallCommand(method.command);
        if (result) {
          console.log(`✅ shfmt installed successfully via ${method.name}`);
          // Find it again after installation
          return await this.findShfmt();
        }
      } catch {
        console.log(`⚠️ ${method.name} installation failed, trying next method...`);
      }
    }

    console.log('❌ Failed to install shfmt. Please install it manually:');
    console.log('   - macOS: brew install shfmt');
    console.log('   - Go: go install mvdan.cc/sh/v3/cmd/shfmt@latest');
    console.log('   - Linux: https://github.com/mvdan/sh/releases');

    return null;
  }

  /**
   * Get platform-specific installation methods
   */
  private getInstallMethods(): Array<{ name: string; command: string }> {
    const platform = process.platform;

    if (platform === 'darwin') {
      return [
        { name: 'Homebrew', command: 'brew install shfmt' },
        { name: 'Go', command: 'go install mvdan.cc/sh/v3/cmd/shfmt@latest' },
      ];
    }

    if (platform === 'linux') {
      return [
        { name: 'apt', command: 'sudo apt-get update && sudo apt-get install -y shfmt' },
        { name: 'Go', command: 'go install mvdan.cc/sh/v3/cmd/shfmt@latest' },
        { name: 'snap', command: 'sudo snap install shfmt' },
      ];
    }

    // Windows or other
    return [
      { name: 'Go', command: 'go install mvdan.cc/sh/v3/cmd/shfmt@latest' },
      { name: 'scoop', command: 'scoop install shfmt' },
    ];
  }

  /**
   * Run an installation command
   */
  private runInstallCommand(command: string): Promise<boolean> {
    return new Promise((resolve) => {
      child_process.exec(command, { timeout: 120000 }, (error) => {
        resolve(!error);
      });
    });
  }

  /**
   * Check if shfmt is available
   */
  async isAvailable(): Promise<boolean> {
    const shfmtPath = await this.ensureShfmt();
    return shfmtPath !== null;
  }

  /**
   * Get shfmt version
   */
  async getVersion(): Promise<string | null> {
    const shfmtPath = await this.ensureShfmt();
    if (!shfmtPath) return null;

    return new Promise((resolve) => {
      child_process.exec(`${shfmtPath} --version`, (error, stdout) => {
        if (error) {
          resolve(null);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }
}

// Export singleton instance
export const shfmtTool = new ShfmtTool();
