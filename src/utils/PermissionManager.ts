export type ToolNames =
  | 'writeFile'
  | 'replace'
  | 'runShellCommand'
  | 'readFile'
  | 'listDirectory'
  | 'searchFileContent'
  | 'glob';

export class PermissionManager {
  private readonly isPlanMode: boolean;
  private readonly restrictedTools: ToolNames[] = ['writeFile', 'replace', 'runShellCommand'];

  constructor(isPlanMode: boolean) {
    this.isPlanMode = isPlanMode;
  }

  canExecute(toolName: string): boolean {
    if (this.isPlanMode) {
      return !this.restrictedTools.includes(toolName as ToolNames);
    }
    return true;
  }
}
