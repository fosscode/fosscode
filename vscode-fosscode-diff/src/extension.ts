import * as vscode from 'vscode';
import { FosscodeDiffProvider } from './fosscodeDiffProvider';

let diffProvider: FosscodeDiffProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Fosscode Diff Viewer extension is now active!');

  // Create and register the diff provider
  diffProvider = new FosscodeDiffProvider(context);
  context.subscriptions.push(diffProvider);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('fosscode-diff.enable', () => {
      diffProvider?.enable();
      vscode.window.showInformationMessage('Fosscode Diff Viewer enabled');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('fosscode-diff.disable', () => {
      diffProvider?.disable();
      vscode.window.showInformationMessage('Fosscode Diff Viewer disabled');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('fosscode-diff.showSettings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'fosscode-diff');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('fosscode-diff.clearHistory', () => {
      diffProvider?.clearHistory();
      vscode.window.showInformationMessage('Diff history cleared');
    })
  );

  // Auto-enable if configured
  const config = vscode.workspace.getConfiguration('fosscode-diff');
  if (config.get('enabled', true)) {
    diffProvider.enable();
  }
}

export function deactivate() {
  diffProvider?.dispose();
}
