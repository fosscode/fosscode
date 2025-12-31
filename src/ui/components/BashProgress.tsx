import { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useStdout } from 'ink';
import Spinner from 'ink-spinner';

interface BashProgressProps {
  /**
   * The command being executed
   */
  command: string;
  /**
   * Whether the command is currently running
   */
  isRunning: boolean;
  /**
   * Current output lines to preview (last N lines)
   */
  outputLines?: string[];
  /**
   * Maximum number of output lines to show
   */
  maxLines?: number;
  /**
   * Start time of command execution
   */
  startTime?: Date;
  /**
   * Whether to show streaming output
   */
  showOutput?: boolean;
}

/**
 * Format elapsed time in a human-readable format
 */
function formatElapsedTime(startTime: Date): string {
  const elapsed = Date.now() - startTime.getTime();
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Truncate a line to fit terminal width
 */
function truncateLine(line: string, maxWidth: number): string {
  if (line.length <= maxWidth) {
    return line;
  }
  return line.substring(0, maxWidth - 3) + '...';
}

/**
 * Progress indicator component for bash commands
 * Shows elapsed time, spinner, and streaming output preview
 */
export function BashProgress({
  command,
  isRunning,
  outputLines = [],
  maxLines = 5,
  startTime,
  showOutput = true,
}: BashProgressProps) {
  const [elapsed, setElapsed] = useState('0s');
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;

  // Update elapsed time every second
  useEffect(() => {
    if (!isRunning || !startTime) return;

    const updateElapsed = () => {
      setElapsed(formatElapsedTime(startTime));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  // Get visible output lines
  const visibleLines = useMemo(() => {
    const lines = outputLines.slice(-maxLines);
    return lines.map(line => truncateLine(line, terminalWidth - 4));
  }, [outputLines, maxLines, terminalWidth]);

  // Truncate command for display
  const displayCommand = useMemo(() => {
    const maxCommandWidth = terminalWidth - 30;
    if (command.length > maxCommandWidth) {
      return command.substring(0, maxCommandWidth - 3) + '...';
    }
    return command;
  }, [command, terminalWidth]);

  if (!isRunning) {
    return null;
  }

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Header with spinner and elapsed time */}
      <Box>
        <Spinner type="dots" />
        <Text color="cyan"> Running: </Text>
        <Text color="yellow">{displayCommand}</Text>
      </Box>

      {/* Elapsed time */}
      <Box marginLeft={2}>
        <Text color="gray">Elapsed: </Text>
        <Text color="white">{elapsed}</Text>
      </Box>

      {/* Streaming output preview */}
      {showOutput && visibleLines.length > 0 && (
        <Box flexDirection="column" marginTop={1} marginLeft={2}>
          <Text color="gray" dimColor>
            --- Output Preview ---
          </Text>
          {visibleLines.map((line, index) => (
            <Text key={index} color="gray">
              {line}
            </Text>
          ))}
          {outputLines.length > maxLines && (
            <Text color="gray" dimColor>
              ... ({outputLines.length - maxLines} more lines)
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}

/**
 * Hook for managing bash progress state
 */
export function useBashProgress() {
  const [isRunning, setIsRunning] = useState(false);
  const [command, setCommand] = useState('');
  const [outputLines, setOutputLines] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<Date | null>(null);

  const start = useCallback((cmd: string) => {
    setCommand(cmd);
    setIsRunning(true);
    setOutputLines([]);
    setStartTime(new Date());
  }, []);

  const addOutput = useCallback((line: string) => {
    setOutputLines(prev => [...prev, line]);
  }, []);

  const addOutputLines = useCallback((lines: string[]) => {
    setOutputLines(prev => [...prev, ...lines]);
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setCommand('');
    setOutputLines([]);
    setStartTime(null);
  }, []);

  return {
    isRunning,
    command,
    outputLines,
    startTime,
    start,
    addOutput,
    addOutputLines,
    stop,
    reset,
  };
}

/**
 * Simple progress bar component
 */
interface ProgressBarProps {
  progress: number; // 0-100
  width?: number;
  showPercentage?: boolean;
  color?: string;
}

export function ProgressBar({
  progress,
  width = 30,
  showPercentage = true,
  color = 'cyan',
}: ProgressBarProps) {
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const filled = Math.round((clampedProgress / 100) * width);
  const empty = width - filled;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  return (
    <Box>
      <Text color={color}>{bar}</Text>
      {showPercentage && (
        <Text color="gray"> {Math.round(clampedProgress)}%</Text>
      )}
    </Box>
  );
}

/**
 * Indeterminate progress spinner with message
 */
interface IndeterminateProgressProps {
  message?: string;
  type?: 'dots' | 'line' | 'bounce';
}

export function IndeterminateProgress({
  message = 'Processing...',
  type = 'dots',
}: IndeterminateProgressProps) {
  const spinnerTypes = {
    dots: 'dots' as const,
    line: 'line' as const,
    bounce: 'bouncingBar' as const,
  };

  return (
    <Box>
      <Spinner type={spinnerTypes[type]} />
      <Text color="cyan"> {message}</Text>
    </Box>
  );
}
