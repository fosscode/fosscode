import { useState, useEffect, useCallback } from 'react';
import {
  isInTmux,
  getEffectiveTerminalSize,
  getTmuxResponsiveBreakpoints,
  addResizeListener,
  updateTmuxStatusLine,
  clearTmuxStatusLine,
  getTmuxInfo,
  setupTmuxKeyBindings,
  addKeyBindingListener,
} from '../../utils/tmuxUtils.js';

export interface UseTmuxReturn {
  // Tmux detection
  isInTmux: boolean;

  // Dimensions and responsive breakpoints
  dimensions: { width: number; height: number };
  responsiveBreakpoints: {
    isSmallScreen: boolean;
    isVerySmallScreen: boolean;
    isExtraSmallScreen: boolean;
  };

  // Tmux session info
  sessionInfo: {
    sessionName: string | null;
    windowName: string | null;
    paneId: string | null;
  };

  // Status line management
  updateStatusLine: (mode: string, provider: string, additionalInfo?: string) => void;
  clearStatusLine: () => void;

  // Key binding management
  setupKeyBindings: (bindings: Record<string, string>) => void;
  onKeyBinding: (callback: (key: string, action: string) => void) => () => void;

  // Resize handling
  onResize: (callback: (newSize: { width: number; height: number }) => void) => () => void;
}

/**
 * React hook for tmux integration and dynamic UI updates
 */
export function useTmux(): UseTmuxReturn {
  const [dimensions, setDimensions] = useState(() => getEffectiveTerminalSize());
  const [sessionInfo, setSessionInfo] = useState(() => {
    const info = getTmuxInfo();
    return {
      sessionName: info.sessionName,
      windowName: info.windowName,
      paneId: info.paneId,
    };
  });

  const [responsiveBreakpoints, setResponsiveBreakpoints] = useState(() =>
    getTmuxResponsiveBreakpoints()
  );

  // Update responsive breakpoints when dimensions change
  useEffect(() => {
    setResponsiveBreakpoints(getTmuxResponsiveBreakpoints());
  }, [dimensions]);

  // Set up resize listener
  useEffect(() => {
    if (!isInTmux()) return;

    const unsubscribe = addResizeListener(newSize => {
      setDimensions(newSize);
    });

    return unsubscribe;
  }, []);

  // Update session info periodically
  useEffect(() => {
    if (!isInTmux()) return;

    const updateSessionInfo = () => {
      // Defer tmux info update to avoid blocking during potential render cycles
      setTimeout(() => {
        const info = getTmuxInfo();
        setSessionInfo({
          sessionName: info.sessionName,
          windowName: info.windowName,
          paneId: info.paneId,
        });
      }, 0);
    };

    // Update session info every 30 seconds
    const interval = setInterval(updateSessionInfo, 30000);
    return () => clearInterval(interval);
  }, []);

  // Status line management
  const updateStatusLine = useCallback(
    (mode: string, provider: string, additionalInfo?: string) => {
      updateTmuxStatusLine(mode, provider, additionalInfo);
    },
    []
  );

  const clearStatusLine = useCallback(() => {
    clearTmuxStatusLine();
  }, []);

  // Key binding management
  const setupKeyBindings = useCallback((bindings: Record<string, string>) => {
    setupTmuxKeyBindings(bindings);
  }, []);

  const onKeyBinding = useCallback((callback: (key: string, action: string) => void) => {
    return addKeyBindingListener(callback);
  }, []);

  // Resize handling
  const onResize = useCallback((callback: (newSize: { width: number; height: number }) => void) => {
    return addResizeListener(callback);
  }, []);

  return {
    isInTmux: isInTmux(),
    dimensions,
    responsiveBreakpoints,
    sessionInfo,
    updateStatusLine,
    clearStatusLine,
    setupKeyBindings,
    onKeyBinding,
    onResize,
  };
}
