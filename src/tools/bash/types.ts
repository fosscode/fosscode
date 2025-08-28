export interface CommandExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  executionTime: number;
}

export interface InstallationCommands {
  [tool: string]: string[];
}

export interface CommandValidationResult {
  isValid: boolean;
  error?: string;
}

export interface ToolDetectionResult {
  tool: string | null;
  shouldInstall: boolean;
}
