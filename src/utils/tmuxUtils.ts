import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tmux detection and pane size utilities
 */
export interface TmuxInfo {
  isInTmux: boolean;
  paneWidth: number | null;
  paneHeight: number | null;
  sessionName: string | null;
  windowName: string | null;
  paneId: string | null;
}

/**
 * Resize event callback type
 */
export type ResizeCallback = (newSize: { width: number; height: number }) => void;

/**
 * Key binding callback type
 */
export type KeyBindingCallback = (key: string, action: string) => void;

// Cache tmux info to avoid repeated execSync calls
let tmuxInfoCache: TmuxInfo | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 2000; // Reduced to 2 seconds for better responsiveness

// Batch command execution to reduce tmux calls
interface BatchedCommand {
  id: string;
  command: string;
  resolve: (result: string) => void;
  reject: (error: Error) => void;
}

let batchedCommands: BatchedCommand[] = [];
let batchTimeout: NodeJS.Timeout | null = null;
const BATCH_DELAY = 50; // 50ms batch delay

/**
 * Execute a tmux command with batching to reduce execSync calls
 */
function executeTmuxCommandBatched(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const id = `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    batchedCommands.push({
      id,
      command,
      resolve,
      reject,
    });

    // Clear existing timeout and set new one
    if (batchTimeout) {
      clearTimeout(batchTimeout);
    }

    batchTimeout = setTimeout(() => {
      processBatchedCommands();
    }, BATCH_DELAY);
  });
}

/**
 * Process all batched tmux commands at once
 */
function processBatchedCommands() {
  if (batchedCommands.length === 0) return;

  const commandsToProcess = [...batchedCommands];
  batchedCommands = [];
  batchTimeout = null;

  try {
    // Execute commands in a single tmux call when possible
    if (commandsToProcess.length === 1) {
      const cmd = commandsToProcess[0];
      try {
        const result = execSync(cmd.command, {
          encoding: 'utf8',
          timeout: 1000,
        }).trim();
        cmd.resolve(result);
      } catch (error) {
        cmd.reject(error instanceof Error ? error : new Error(String(error)));
      }
    } else {
      // For multiple commands, try to batch them
      const batchedCommand = commandsToProcess
        .map(cmd => cmd.command.replace(/^tmux\s+/, ''))
        .join('; ');

      try {
        const result = execSync(`tmux ${batchedCommand}`, {
          encoding: 'utf8',
          timeout: 2000,
        }).trim();

        // Split results and resolve each command
        const results = result.split('\n');
        commandsToProcess.forEach((cmd, index) => {
          cmd.resolve(results[index] || '');
        });
      } catch (error) {
        // If batching fails, fall back to individual execution
        commandsToProcess.forEach(async cmd => {
          try {
            const result = execSync(cmd.command, {
              encoding: 'utf8',
              timeout: 1000,
            }).trim();
            cmd.resolve(result);
          } catch (execError) {
            cmd.reject(execError instanceof Error ? execError : new Error(String(execError)));
          }
        });
      }
    }
  } catch (error) {
    // Reject all commands if batch processing fails
    commandsToProcess.forEach(cmd => {
      cmd.reject(error instanceof Error ? error : new Error(String(error)));
    });
  }
}

// Resize detection state
const resizeListeners: ResizeCallback[] = [];
let resizeDebounceTimer: NodeJS.Timeout | null = null;
const RESIZE_DEBOUNCE_MS = 250; // 250ms debounce
let isMonitoringResize = false;
let resizeMonitorInterval: NodeJS.Timeout | null = null;

// Key binding state
const keyBindingListeners: KeyBindingCallback[] = [];
let keyBindingMonitorInterval: NodeJS.Timeout | null = null;
const KEY_BINDING_CHECK_INTERVAL = 100; // Check every 100ms

// Lazy loading state
let tmuxFeaturesInitialized = false;
let statusLineFeatureAvailable: boolean | null = null;
let keyBindingFeatureAvailable: boolean | null = null;

/**
 * Lazy initialization of tmux-specific features
 */
function initializeTmuxFeatures() {
  if (tmuxFeaturesInitialized || !isInTmux()) return;

  tmuxFeaturesInitialized = true;

  // Defer feature detection to avoid blocking during React rendering
  setImmediate(() => {
    try {
      // Test if status line feature is available
      execSync('tmux set-status-left ""', { timeout: 500, stdio: 'ignore' });
      statusLineFeatureAvailable = true;
    } catch (error) {
      statusLineFeatureAvailable = false;
    }

    try {
      // Test if key binding feature is available
      execSync('tmux list-keys >/dev/null 2>&1', { timeout: 500 });
      keyBindingFeatureAvailable = true;
    } catch (error) {
      keyBindingFeatureAvailable = false;
    }
  });
}

/**
 * Check if a tmux feature is available (with lazy loading)
 */
function isFeatureAvailable(feature: 'status-line' | 'key-bindings'): boolean {
  if (!isInTmux()) return false;

  initializeTmuxFeatures();

  switch (feature) {
    case 'status-line':
      return statusLineFeatureAvailable === true;
    case 'key-bindings':
      return keyBindingFeatureAvailable === true;
    default:
      return false;
  }
}

/**
 * Detect if running inside tmux and get pane information (async version)
 */
export async function getTmuxInfoAsync(): Promise<TmuxInfo> {
  const isInTmux = process.env.TMUX !== undefined;

  if (!isInTmux) {
    return {
      isInTmux: false,
      paneWidth: null,
      paneHeight: null,
      sessionName: null,
      windowName: null,
      paneId: null,
    };
  }

  // Return cached info if still valid
  const now = Date.now();
  if (tmuxInfoCache && now - cacheTimestamp < CACHE_DURATION) {
    return tmuxInfoCache;
  }

  try {
    // Get all tmux info using batched execution
    const tmuxOutput = await executeTmuxCommandBatched(
      'tmux display-message -p "#{pane_width},#{pane_height},#{session_name},#{window_name},#{pane_id}"'
    );

    const [paneWidth, paneHeight, sessionName, windowName, paneId] = tmuxOutput.split(',');

    tmuxInfoCache = {
      isInTmux: true,
      paneWidth: parseInt(paneWidth, 10) || null,
      paneHeight: parseInt(paneHeight, 10) || null,
      sessionName: sessionName || null,
      windowName: windowName || null,
      paneId: paneId || null,
    };

    cacheTimestamp = now;
    return tmuxInfoCache;
  } catch (error) {
    // Fallback if tmux commands fail
    tmuxInfoCache = {
      isInTmux: true,
      paneWidth: null,
      paneHeight: null,
      sessionName: null,
      windowName: null,
      paneId: null,
    };
    cacheTimestamp = now;
    return tmuxInfoCache;
  }
}

/**
 * Detect if running inside tmux and get pane information (sync version for backward compatibility)
 */
export function getTmuxInfo(): TmuxInfo {
  const isInTmux = process.env.TMUX !== undefined;

  if (!isInTmux) {
    return {
      isInTmux: false,
      paneWidth: null,
      paneHeight: null,
      sessionName: null,
      windowName: null,
      paneId: null,
    };
  }

  // Return cached info if still valid
  const now = Date.now();
  if (tmuxInfoCache && now - cacheTimestamp < CACHE_DURATION) {
    return tmuxInfoCache;
  }

  try {
    // Get all tmux info in a single command to reduce execSync calls
    // Use synchronous exec for compatibility, but this should be called outside render cycle
    const tmuxOutput = execSync(
      'tmux display-message -p "#{pane_width},#{pane_height},#{session_name},#{window_name},#{pane_id}"',
      {
        encoding: 'utf8',
        timeout: 1000,
      }
    ).trim();

    const [paneWidth, paneHeight, sessionName, windowName, paneId] = tmuxOutput.split(',');

    tmuxInfoCache = {
      isInTmux: true,
      paneWidth: parseInt(paneWidth, 10) || null,
      paneHeight: parseInt(paneHeight, 10) || null,
      sessionName: sessionName || null,
      windowName: windowName || null,
      paneId: paneId || null,
    };

    cacheTimestamp = now;
    return tmuxInfoCache;
  } catch (error) {
    // Fallback if tmux commands fail
    tmuxInfoCache = {
      isInTmux: true,
      paneWidth: null,
      paneHeight: null,
      sessionName: null,
      windowName: null,
      paneId: null,
    };
    cacheTimestamp = now;
    return tmuxInfoCache;
  }
}

/**
 * Get the effective terminal dimensions, accounting for tmux panes
 */
export function getEffectiveTerminalSize(): { width: number; height: number } {
  const tmuxInfo = getTmuxInfo();

  // If in tmux and we have pane dimensions, use those
  if (tmuxInfo.isInTmux && tmuxInfo.paneWidth && tmuxInfo.paneHeight) {
    return {
      width: tmuxInfo.paneWidth,
      height: tmuxInfo.paneHeight,
    };
  }

  // Fallback to standard terminal dimensions
  return {
    width: process.stdout.columns ?? 80,
    height: process.stdout.rows ?? 24,
  };
}

/**
 * Check if we're in a tmux environment
 */
export function isInTmux(): boolean {
  return process.env.TMUX !== undefined;
}

/**
 * Get tmux-specific responsive breakpoints
 */
export function getTmuxResponsiveBreakpoints() {
  const { width, height } = getEffectiveTerminalSize();

  return {
    isSmallScreen: width < 60 || height < 15,
    isVerySmallScreen: width < 40 || height < 10,
    isExtraSmallScreen: width < 30 || height < 8,
  };
}

/**
 * Add a resize event listener
 */
export function addResizeListener(callback: ResizeCallback): () => void {
  resizeListeners.push(callback);

  // Start monitoring if not already started
  if (!isMonitoringResize) {
    startResizeMonitoring();
  }

  // Return unsubscribe function
  return () => {
    const index = resizeListeners.indexOf(callback);
    if (index > -1) {
      resizeListeners.splice(index, 1);
    }
    if (resizeListeners.length === 0) {
      stopResizeMonitoring();
    }
  };
}

/**
 * Start monitoring for pane resize events
 */
function startResizeMonitoring() {
  if (isMonitoringResize || !isInTmux()) return;

  isMonitoringResize = true;

  // Defer tmux operations to avoid blocking React rendering
  setImmediate(() => {
    // Set up tmux hook for pane resize events
    try {
      execSync(
        'tmux set-hook -g pane-resized "run-shell \\"echo pane-resized >> /tmp/tmux-resize-events\\""',
        {
          timeout: 1000,
          stdio: 'ignore',
        }
      );
    } catch (error) {
      // Fallback to polling if hooks fail
      console.warn('Failed to set tmux resize hook, falling back to polling');
    }
  });

  // Monitor for resize events
  resizeMonitorInterval = setInterval(() => {
    checkForResizeEvents();
  }, 100); // Check every 100ms
}

/**
 * Stop monitoring for pane resize events
 */
function stopResizeMonitoring() {
  if (!isMonitoringResize) return;

  isMonitoringResize = false;

  if (resizeMonitorInterval) {
    clearInterval(resizeMonitorInterval);
    resizeMonitorInterval = null;
  }

  // Clean up tmux hook
  try {
    execSync('tmux set-hook -g pane-resized ""', {
      timeout: 1000,
      stdio: 'ignore',
    });
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Check for resize events and notify listeners
 */
export function checkForResizeEvents() {
  const currentSize = getEffectiveTerminalSize();
  const previousInfo = tmuxInfoCache;

  if (!previousInfo?.paneWidth || !previousInfo?.paneHeight) {
    return;
  }

  const hasResized =
    currentSize.width !== previousInfo.paneWidth || currentSize.height !== previousInfo.paneHeight;

  if (hasResized) {
    // Debounce the resize event
    if (resizeDebounceTimer) {
      clearTimeout(resizeDebounceTimer);
    }

    resizeDebounceTimer = setTimeout(() => {
      notifyResizeListeners(currentSize);
    }, RESIZE_DEBOUNCE_MS);
  }
}

/**
 * Notify all resize listeners of a resize event
 */
function notifyResizeListeners(newSize: { width: number; height: number }) {
  resizeListeners.forEach(callback => {
    try {
      callback(newSize);
    } catch (error) {
      console.error('Error in resize callback:', error);
    }
  });
}

/**
 * Add a key binding listener
 */
export function addKeyBindingListener(callback: KeyBindingCallback): () => void {
  keyBindingListeners.push(callback);

  // Start monitoring if not already started
  if (!keyBindingMonitorInterval) {
    startKeyBindingMonitoring();
  }

  // Return unsubscribe function
  return () => {
    const index = keyBindingListeners.indexOf(callback);
    if (index > -1) {
      keyBindingListeners.splice(index, 1);
    }
    if (keyBindingListeners.length === 0) {
      stopKeyBindingMonitoring();
    }
  };
}

/**
 * Start monitoring for key binding events
 */
function startKeyBindingMonitoring() {
  if (keyBindingMonitorInterval !== null || !isInTmux()) return;

  keyBindingMonitorInterval = setInterval(() => {
    checkForKeyBindingEvents();
  }, KEY_BINDING_CHECK_INTERVAL);
}

/**
 * Stop monitoring for key binding events
 */
function stopKeyBindingMonitoring() {
  if (keyBindingMonitorInterval) {
    clearInterval(keyBindingMonitorInterval);
    keyBindingMonitorInterval = null;
  }
}

/**
 * Check for key binding events and notify listeners
 */
function checkForKeyBindingEvents() {
  // This is a simplified implementation - in a real scenario,
  // you might use tmux's send-keys or bind-key with custom commands
  // For now, we'll monitor for specific tmux key sequences
  try {
    // Check if there are pending key events (this is a placeholder implementation)
    // In practice, you might use tmux's buffer or custom key bindings
    const pendingKeys = execSync('tmux show-buffer 2>/dev/null || echo ""', {
      encoding: 'utf8',
      timeout: 100,
    }).trim();

    if (pendingKeys) {
      // Clear the buffer
      execSync('tmux delete-buffer', { timeout: 100, stdio: 'ignore' });

      // Parse and notify listeners
      const keyEvents = pendingKeys.split('\n').filter(line => line.trim());
      keyEvents.forEach(event => {
        const [key, action] = event.split(':');
        if (key && action) {
          notifyKeyBindingListeners(key.trim(), action.trim());
        }
      });
    }
  } catch (error) {
    // Ignore errors in key binding monitoring
  }
}

/**
 * Notify all key binding listeners
 */
function notifyKeyBindingListeners(key: string, action: string) {
  keyBindingListeners.forEach(callback => {
    try {
      callback(key, action);
    } catch (error) {
      console.error('Error in key binding callback:', error);
    }
  });
}

/**
 * Set up tmux key bindings for common actions
 */
export function setupTmuxKeyBindings(bindings: Record<string, string>) {
  if (!isFeatureAvailable('key-bindings')) return;

  try {
    // Clear existing bindings first
    execSync('tmux unbind-key -a', { timeout: 1000, stdio: 'ignore' });

    // Set up new bindings
    Object.entries(bindings).forEach(([key, action]) => {
      const tmuxCommand = `tmux bind-key ${key} run-shell "echo '${key}:${action}' | tmux load-buffer - && tmux paste-buffer"`;
      execSync(tmuxCommand, { timeout: 1000, stdio: 'ignore' });
    });
  } catch (error) {
    console.warn('Failed to set up tmux key bindings:', error);
  }
}

/**
 * Update tmux status line with current mode/provider information
 */
export function updateTmuxStatusLine(mode: string, provider: string, additionalInfo?: string) {
  if (!isFeatureAvailable('status-line')) return;

  try {
    const statusText = `[${mode}] ${provider}${additionalInfo ? ` ${additionalInfo}` : ''}`;
    const tmuxCommand = `tmux set-status-left "${statusText}"`;

    execSync(tmuxCommand, { timeout: 1000, stdio: 'ignore' });
  } catch (error) {
    console.warn('Failed to update tmux status line:', error);
  }
}

/**
 * Clear tmux status line
 */
export function clearTmuxStatusLine() {
  if (!isFeatureAvailable('status-line')) return;

  try {
    execSync('tmux set-status-left ""', { timeout: 1000, stdio: 'ignore' });
  } catch (error) {
    console.warn('Failed to clear tmux status line:', error);
  }
}

/**
 * Get session-specific storage key for chat history
 */
export function getSessionStorageKey(): string | null {
  const tmuxInfo = getTmuxInfo();
  if (!tmuxInfo.isInTmux || !tmuxInfo.sessionName) {
    return null;
  }
  return `tmux-chat-${tmuxInfo.sessionName}`;
}

/**
 * Save chat history for the current tmux session
 */
export function saveChatHistoryToSession(history: any[]): boolean {
  const storageKey = getSessionStorageKey();
  if (!storageKey) return false;

  try {
    // Create temp directory if it doesn't exist
    const tempDir = '/tmp/tmux-chat-sessions';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, `${storageKey}.json`);
    fs.writeFileSync(filePath, JSON.stringify(history, null, 2));

    return true;
  } catch (error) {
    console.warn('Failed to save chat history to session:', error);
    return false;
  }
}

/**
 * Load chat history for the current tmux session
 */
export function loadChatHistoryFromSession(): any[] | null {
  const storageKey = getSessionStorageKey();
  if (!storageKey) return null;

  try {
    const tempDir = '/tmp/tmux-chat-sessions';
    const filePath = path.join(tempDir, `${storageKey}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const data = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(data);

    // Convert timestamp strings back to Date objects
    return parsed.map((message: any) => ({
      ...message,
      timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
    }));
  } catch (error) {
    console.warn('Failed to load chat history from session:', error);
    return null;
  }
}

/**
 * Clean up old session files (older than 7 days)
 */
export function cleanupOldSessionFiles() {
  try {
    const tempDir = '/tmp/tmux-chat-sessions';
    if (!fs.existsSync(tempDir)) return;

    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    files.forEach((file: string) => {
      const filePath = path.join(tempDir, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtime.getTime() > sevenDaysMs) {
        fs.unlinkSync(filePath);
      }
    });
  } catch (error) {
    console.warn('Failed to cleanup old session files:', error);
  }
}
