import chalk from 'chalk';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export class VSCodeCommand {
  private readonly extensionPath: string;

  constructor() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // Path to the VSCode extension - handle both src and dist execution
    // When bundled, __dirname might be different, so use process.cwd() as fallback
    let projectRoot = join(__dirname, '../..');
    if (!existsSync(join(projectRoot, 'vscode-fosscode-diff'))) {
      projectRoot = process.cwd();
    }
    this.extensionPath = join(projectRoot, 'vscode-fosscode-diff/vscode-fosscode-diff-0.0.1.vsix');
  }

  async execute(action?: string): Promise<void> {
    try {
      switch (action) {
        case 'install':
          await this.installExtension();
          break;
        case 'setup':
          await this.setupExtension();
          break;
        case 'status':
          this.showStatus();
          break;
        default:
          this.showHelp();
          break;
      }
    } catch (error) {
      console.error(
        chalk.red('VSCode command error:'),
        error instanceof Error ? error.message : 'Unknown error'
      );
      process.exit(1);
    }
  }

  private async installExtension(): Promise<void> {
    console.log(chalk.blue('🔧 Installing VSCode fosscode diff extension...'));

    // Check if VSCode is installed
    if (!this.isVSCodeInstalled()) {
      console.log(chalk.yellow('⚠️  VSCode not found. Please install VSCode first:'));
      console.log(chalk.gray('   https://code.visualstudio.com/download'));
      console.log('');
      console.log(chalk.yellow('Then run: fosscode code install'));
      return;
    }

    // Check if extension file exists
    if (!existsSync(this.extensionPath)) {
      console.log(chalk.red('❌ Extension file not found at:'));
      console.log(chalk.gray(`   ${this.extensionPath}`));
      console.log('');
      console.log(chalk.yellow('Please ensure the extension has been built.'));
      return;
    }

    try {
      // Install the extension
      const command = `code --install-extension "${this.extensionPath}" --force`;
      console.log(chalk.gray(`Running: ${command}`));

      execSync(command, { stdio: 'inherit' });

      console.log('');
      console.log(chalk.green('✅ VSCode extension installed successfully!'));
      console.log('');
      console.log(chalk.blue('📝 Next steps:'));
      console.log("1. Restart VSCode if it's running");
      console.log('2. The extension will automatically detect fosscode file changes');
      console.log('3. Use fosscode edit commands to see diffs in VSCode');
    } catch (error) {
      console.log(chalk.red('❌ Failed to install extension automatically.'));
      console.log('');
      this.showManualInstallInstructions();
    }
  }

  private async setupExtension(): Promise<void> {
    console.log(chalk.blue('🔧 Setting up VSCode fosscode diff extension...'));
    console.log('');

    if (!this.isVSCodeInstalled()) {
      console.log(chalk.yellow('⚠️  VSCode not found. Please install VSCode first.'));
      console.log(chalk.gray('   Download: https://code.visualstudio.com/download'));
      console.log('');
    }

    this.showManualInstallInstructions();
  }

  private showStatus(): void {
    console.log(chalk.blue('📊 VSCode Extension Status'));
    console.log('');

    const vscodeInstalled = this.isVSCodeInstalled();
    const extensionExists = existsSync(this.extensionPath);

    console.log(`VSCode installed: ${vscodeInstalled ? chalk.green('✅') : chalk.red('❌')}`);
    console.log(`Extension file: ${extensionExists ? chalk.green('✅') : chalk.red('❌')}`);
    console.log(`Extension path: ${chalk.gray(this.extensionPath)}`);

    if (vscodeInstalled && extensionExists) {
      console.log('');
      console.log(chalk.green('🎉 Ready to install! Run: fosscode code install'));
    } else {
      console.log('');
      console.log(chalk.yellow('⚠️  Please resolve the issues above first.'));
    }
  }

  private showHelp(): void {
    console.log(chalk.blue('🛠️  VSCode fosscode Diff Extension'));
    console.log('');
    console.log('This extension shows fosscode file edits as diffs in VSCode.');
    console.log('');
    console.log(chalk.yellow('Usage:'));
    console.log('  fosscode code install    - Install the extension automatically');
    console.log('  fosscode code setup      - Show manual setup instructions');
    console.log('  fosscode code status     - Check installation status');
    console.log('  fosscode code            - Show this help');
    console.log('');
    console.log(chalk.yellow('How it works:'));
    console.log('1. Install the extension');
    console.log('2. Use fosscode edit commands');
    console.log('3. See diffs automatically in VSCode');
  }

  private isVSCodeInstalled(): boolean {
    try {
      execSync('code --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private showManualInstallInstructions(): void {
    console.log(chalk.yellow('📋 Manual Installation Instructions:'));
    console.log('');
    console.log('1. Install VSCode from: https://code.visualstudio.com/download');
    console.log('');
    console.log('2. Install the extension:');
    console.log(chalk.gray(`   code --install-extension "${this.extensionPath}"`));
    console.log('');
    console.log('3. Or install manually:');
    console.log('   - Open VSCode');
    console.log('   - Press Ctrl+Shift+P (Cmd+Shift+P on Mac)');
    console.log('   - Type "Extensions: Install from VSIX"');
    console.log(`   - Select: ${chalk.gray('vscode-fosscode-diff-0.0.1.vsix')}`);
    console.log('');
    console.log('4. Restart VSCode');
    console.log('');
    console.log('5. Use fosscode edit commands to see diffs!');
  }
}
