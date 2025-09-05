# Fosscode Diff Viewer

A VSCode extension that shows diffs for file edits made by fosscode in the terminal.

## Features

- **Real-time Diff Display**: Automatically shows diffs when fosscode modifies files
- **VSCode Integration**: Uses VSCode's built-in diff viewer for familiar interface
- **Status Bar Integration**: Shows extension status and provides quick access to controls
- **Configurable**: Customize behavior through VSCode settings
- **History Management**: Keeps track of recent diffs and prevents duplicates

## Installation

1. Clone this repository
2. Run `npm install` in the extension directory
3. Run `npm run compile` to build the extension
4. Open the extension directory in VSCode
5. Press F5 to launch extension development host
6. The extension will be loaded in the new window

## Usage

1. Open a terminal in VSCode
2. Run fosscode commands that edit files (e.g., `fosscode edit file.txt`)
3. The extension will automatically detect file changes and show diffs
4. Click "Show Diff" in notifications or use the status bar indicator

## Configuration

The extension can be configured through VSCode settings (`fosscode-diff.*`):

- `fosscode-diff.enabled`: Enable/disable the extension
- `fosscode-diff.tempDir`: Custom directory for temporary files
- `fosscode-diff.autoShowDiffs`: Automatically show diffs when detected
- `fosscode-diff.maxHistorySize`: Maximum number of diffs to keep in history
- `fosscode-diff.showNotifications`: Show notifications for detected changes

## Commands

- `Fosscode Diff: Enable`: Enable the diff viewer
- `Fosscode Diff: Disable`: Disable the diff viewer
- `Fosscode Diff: Open Settings`: Open extension settings
- `Fosscode Diff: Clear History`: Clear diff history

## How It Works

1. **File Monitoring**: The extension monitors a temporary directory for diff files created by fosscode
2. **Content Provision**: Uses VSCode's `TextDocumentContentProvider` to provide original file content
3. **Diff Display**: Leverages VSCode's built-in diff functionality to show changes
4. **Terminal Integration**: Detects fosscode execution through terminal shell integration

## Development

### Building fosscode with Diff Support

The extension requires modifications to fosscode's EditTool to generate diff information:

1. Edit `src/tools/EditTool.ts` to include diff generation
2. Rebuild fosscode: `npm run build`
3. Test with: `node dist/index.js`

### Testing the Extension

1. Build the extension: `npm run compile`
2. Test diff file creation: `node test-diff.js`
3. Open in VSCode development host (F5)
4. Use fosscode to edit files and observe diff notifications

## Architecture

- **FosscodeDiffProvider**: Main extension class handling file watching and diff display
- **FosscodeOriginalContentProvider**: Provides original file content for diffing
- **EditTool Integration**: Modified to generate diff files in temp directory
- **Status Bar**: Shows extension status and provides controls

## Troubleshooting

- **No diffs showing**: Check that fosscode is generating diff files in the temp directory
- **Extension not loading**: Ensure the extension is properly compiled and VSCode is restarted
- **Temp directory issues**: Check permissions and try setting a custom temp directory in settings
