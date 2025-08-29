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

  try {
    // Get tmux pane dimensions using tmux display-message
    const paneWidth = execSync('tmux display-message -p "#{pane_width}"', {
      encoding: 'utf8',
      timeout: 1000,
    }).trim();

    const paneHeight = execSync('tmux display-message -p "#{pane_height}"', {
      encoding: 'utf8',
      timeout: 1000,
    }).trim();

    const sessionName = execSync('tmux display-message -p "#{session_name}"', {
      encoding: 'utf8',
      timeout: 1000,
    }).trim();

    const windowName = execSync('tmux display-message -p "#{window_name}"', {
      encoding: 'utf8',
      timeout: 1000,
    }).trim();

    const paneId = execSync('tmux display-message -p "#{pane_id}"', {
      encoding: 'utf8',
      timeout: 1000,
    }).trim();

    return {
      isInTmux: true,
      paneWidth: parseInt(paneWidth, 10) || null,
      paneHeight: parseInt(paneHeight, 10) || null,
      sessionName,
      windowName,
      paneId,
    };
  } catch (error) {
    // Fallback if tmux commands fail
    return {
      isInTmux: true,
      paneWidth: null,
      paneHeight: null,
      sessionName: null,
      windowName: null,
      paneId: null,
    };
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
