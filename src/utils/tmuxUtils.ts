import { execSync } from 'child_process';

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

// Cache tmux info to avoid repeated execSync calls
let tmuxInfoCache: TmuxInfo | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5000; // 5 seconds

/**
 * Detect if running inside tmux and get pane information
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
    width: process.stdout.columns || 80,
    height: process.stdout.rows || 24,
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
