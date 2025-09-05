import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export class FosscodeDiffProvider {
  private context: vscode.ExtensionContext;
  private enabled = false;
  private fileWatcher?: vscode.FileSystemWatcher;
  private tempDir: string;
  private originalContentProvider: FosscodeOriginalContentProvider;
  private originalContentProviderDisposable?: vscode.Disposable;
  private processedFiles: Set<string> = new Set();
  private statusBarItem?: vscode.StatusBarItem;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.tempDir = this.getTempDir();
    this.originalContentProvider = new FosscodeOriginalContentProvider(this.tempDir);
  }

  public enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.setupFileWatching();
    this.registerContentProvider();
    this.setupTerminalMonitoring();
    this.updateStatusBar();
  }

  public disable(): void {
    if (!this.enabled) return;
    this.enabled = false;
    this.disposeFileWatcher();
    this.disposeContentProvider();
    this.updateStatusBar();
  }

  private updateStatusBar(): void {
    if (!this.statusBarItem) {
      this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
      this.statusBarItem.command = 'fosscode-diff.disable';
      this.context.subscriptions.push(this.statusBarItem);
    }

    if (this.enabled) {
      this.statusBarItem.text = '$(diff) Fosscode Diff';
      this.statusBarItem.tooltip = 'Fosscode Diff Viewer is active - Click to disable';
      this.statusBarItem.command = 'fosscode-diff.disable';
      this.statusBarItem.show();
    } else {
      this.statusBarItem.text = '$(diff) Fosscode Diff (Disabled)';
      this.statusBarItem.tooltip = 'Fosscode Diff Viewer is disabled - Click to enable';
      this.statusBarItem.command = 'fosscode-diff.enable';
      this.statusBarItem.show();
    }
  }

  private setupFileWatching(): void {
    const pattern = new vscode.RelativePattern(vscode.Uri.file(this.tempDir), 'fosscode-*.json');

    this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
    this.fileWatcher.onDidChange(this.handleFileChange, this);
    this.fileWatcher.onDidCreate(this.handleFileChange, this);

    this.context.subscriptions.push(this.fileWatcher);
  }

  private registerContentProvider(): void {
    this.originalContentProviderDisposable = vscode.workspace.registerTextDocumentContentProvider(
      'fosscode-original',
      this.originalContentProvider
    );
    this.context.subscriptions.push(this.originalContentProviderDisposable);
  }

  private setupTerminalMonitoring(): void {
    vscode.window.onDidStartTerminalShellExecution(
      event => {
        if (event.execution.commandLine.value.includes('fosscode')) {
          this.handleFosscodeExecution(event);
        }
      },
      this,
      this.context.subscriptions
    );
  }

  private handleFosscodeExecution(event: vscode.TerminalShellExecutionStartEvent): void {
    vscode.window.onDidEndTerminalShellExecution(
      endEvent => {
        if (endEvent.execution === event.execution) {
          this.processDiffFiles();
        }
      },
      this,
      this.context.subscriptions
    );
  }

  private async handleFileChange(uri: vscode.Uri): Promise<void> {
    try {
      const content = await vscode.workspace.fs.readFile(uri);
      const diffData = JSON.parse(content.toString());

      if (diffData.type === 'file_change') {
        const fileKey = `${diffData.filePath}-${diffData.timestamp}`;

        // Avoid processing the same diff multiple times
        if (this.processedFiles.has(fileKey)) {
          return;
        }

        this.processedFiles.add(fileKey);
        await this.showDiff(diffData);

        // Clean up old processed files based on configuration
        const config = vscode.workspace.getConfiguration('fosscode-diff');
        const maxHistorySize = config.get('maxHistorySize', 50);

        if (this.processedFiles.size > maxHistorySize) {
          const entries = Array.from(this.processedFiles);
          this.processedFiles = new Set(entries.slice(-Math.floor(maxHistorySize / 2)));
        }
      }
    } catch (error) {
      console.error('Error handling file change:', error);
    }
  }

  private async processDiffFiles(): Promise<void> {
    const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(this.tempDir));

    for (const [fileName, fileType] of files) {
      if (
        fileName.startsWith('fosscode-') &&
        fileName.endsWith('.json') &&
        fileType === vscode.FileType.File
      ) {
        const fileUri = vscode.Uri.file(path.join(this.tempDir, fileName));
        await this.handleFileChange(fileUri);
      }
    }
  }

  private async showDiff(diffData: any): Promise<void> {
    const { filePath, originalContent } = diffData;

    if (!filePath || !originalContent) return;

    const config = vscode.workspace.getConfiguration('fosscode-diff');
    const autoShowDiffs = config.get('autoShowDiffs', true);
    const showNotifications = config.get('showNotifications', true);

    const originalFileName = path.basename(filePath);
    await this.storeOriginalContent(originalFileName, originalContent);

    const originalUri = vscode.Uri.parse(`fosscode-original://${originalFileName}`);
    const fileUri = vscode.Uri.file(filePath);

    // Show diff between original and current file content
    if (autoShowDiffs) {
      await vscode.commands.executeCommand(
        'vscode.diff',
        originalUri,
        fileUri,
        `Fosscode Edit: ${originalFileName}`
      );
    }

    // Show notification
    if (showNotifications) {
      const message = `Fosscode modified: ${originalFileName}`;
      const showDiffButton = 'Show Diff';
      const dismissButton = 'Dismiss';

      const result = await vscode.window.showInformationMessage(
        message,
        showDiffButton,
        dismissButton
      );

      if (result === showDiffButton) {
        await vscode.commands.executeCommand(
          'vscode.diff',
          originalUri,
          fileUri,
          `Fosscode Edit: ${originalFileName}`
        );
      }
    }
  }

  private async storeOriginalContent(fileName: string, content: string): Promise<void> {
    const originalPath = path.join(this.tempDir, `original-${fileName}`);
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(originalPath),
      Buffer.from(content, 'utf8')
    );
  }

  private getTempDir(): string {
    const config = vscode.workspace.getConfiguration('fosscode-diff');
    const customTempDir = config.get('tempDir', '') as string;

    if (customTempDir) {
      return customTempDir;
    }

    return path.join(os.tmpdir(), 'vscode-fosscode-diff');
  }

  private disposeFileWatcher(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
      this.fileWatcher = undefined;
    }
  }

  private disposeContentProvider(): void {
    if (this.originalContentProviderDisposable) {
      this.originalContentProviderDisposable.dispose();
      this.originalContentProviderDisposable = undefined;
    }
  }

  public clearHistory(): void {
    this.processedFiles.clear();
  }

  public dispose(): void {
    this.disable();
    if (this.statusBarItem) {
      this.statusBarItem.dispose();
      this.statusBarItem = undefined;
    }
  }
}

class FosscodeOriginalContentProvider implements vscode.TextDocumentContentProvider {
  private tempDir: string;

  constructor(tempDir: string) {
    this.tempDir = tempDir;
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    try {
      const fileName = uri.path;
      const originalPath = path.join(this.tempDir, `original-${fileName}`);
      const content = fs.readFileSync(originalPath, 'utf8');
      return content;
    } catch (error) {
      console.error('Error reading original content:', error);
      return '';
    }
  }
}
