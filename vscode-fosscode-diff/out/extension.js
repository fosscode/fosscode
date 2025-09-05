"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const fosscodeDiffProvider_1 = require("./fosscodeDiffProvider");
let diffProvider;
function activate(context) {
    console.log('Fosscode Diff Viewer extension is now active!');
    // Create and register the diff provider
    diffProvider = new fosscodeDiffProvider_1.FosscodeDiffProvider(context);
    context.subscriptions.push(diffProvider);
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand('fosscode-diff.enable', () => {
        diffProvider?.enable();
        vscode.window.showInformationMessage('Fosscode Diff Viewer enabled');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('fosscode-diff.disable', () => {
        diffProvider?.disable();
        vscode.window.showInformationMessage('Fosscode Diff Viewer disabled');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('fosscode-diff.showSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'fosscode-diff');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('fosscode-diff.clearHistory', () => {
        diffProvider?.clearHistory();
        vscode.window.showInformationMessage('Diff history cleared');
    }));
    // Auto-enable if configured
    const config = vscode.workspace.getConfiguration('fosscode-diff');
    if (config.get('enabled', true)) {
        diffProvider.enable();
    }
}
exports.activate = activate;
function deactivate() {
    diffProvider?.dispose();
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map