'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.FosscodeDiffProvider = void 0;
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const os = require('os');
class FosscodeDiffProvider {
  constructor(context) {
    this.enabled = false;
    this.processedFiles = new Set();
    this.context = context;
    this.tempDir = this.getTempDir();
    this.originalContentProvider = new FosscodeOriginalContentProvider(this.tempDir);
  }
  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.setupFileWatching();
    this.registerContentProvider();
    this.setupTerminalMonitoring();
    this.updateStatusBar();
  }
  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this.disposeFileWatcher();
    this.disposeContentProvider();
    this.updateStatusBar();
  }
  updateStatusBar() {
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
  setupFileWatching() {
    const pattern = new vscode.RelativePattern(vscode.Uri.file(this.tempDir), 'fosscode-*.json');
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
    this.fileWatcher.onDidChange(this.handleFileChange, this);
    this.fileWatcher.onDidCreate(this.handleFileChange, this);
    this.context.subscriptions.push(this.fileWatcher);
  }
  registerContentProvider() {
    this.originalContentProviderDisposable = vscode.workspace.registerTextDocumentContentProvider(
      'fosscode-original',
      this.originalContentProvider
    );
    this.context.subscriptions.push(this.originalContentProviderDisposable);
  }
  setupTerminalMonitoring() {
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
  handleFosscodeExecution(event) {
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
  async handleFileChange(uri) {
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
  async processDiffFiles() {
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
  async showDiff(diffData) {
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
  async storeOriginalContent(fileName, content) {
    const originalPath = path.join(this.tempDir, `original-${fileName}`);
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(originalPath),
      Buffer.from(content, 'utf8')
    );
  }
  getTempDir() {
    const config = vscode.workspace.getConfiguration('fosscode-diff');
    const customTempDir = config.get('tempDir', '');
    if (customTempDir) {
      return customTempDir;
    }
    return path.join(os.tmpdir(), 'vscode-fosscode-diff');
  }
  disposeFileWatcher() {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
      this.fileWatcher = undefined;
    }
  }
  disposeContentProvider() {
    if (this.originalContentProviderDisposable) {
      this.originalContentProviderDisposable.dispose();
      this.originalContentProviderDisposable = undefined;
    }
  }
  clearHistory() {
    this.processedFiles.clear();
  }
  dispose() {
    this.disable();
    if (this.statusBarItem) {
      this.statusBarItem.dispose();
      this.statusBarItem = undefined;
    }
  }
}
exports.FosscodeDiffProvider = FosscodeDiffProvider;
class FosscodeOriginalContentProvider {
  constructor(tempDir) {
    this.tempDir = tempDir;
  }
  provideTextDocumentContent(uri) {
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
//# sourceMappingURL=fosscodeDiffProvider.js.map
