import { useState, useCallback } from 'react';

export function useHistoryNavigation() {
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [originalInput, setOriginalInput] = useState('');

  const addToHistory = useCallback((command: string) => {
    setCommandHistory(prev => {
      const newHistory = [...prev];
      if (newHistory[newHistory.length - 1] !== command) {
        newHistory.push(command);
      }
      return newHistory;
    });
  }, []);

  const navigateHistory = useCallback(
    (direction: 'up' | 'down', currentInput: string, setInput: (value: string) => void) => {
      if (direction === 'up') {
        if (commandHistory.length > 0) {
          if (historyIndex === -1) {
            // Save current input before navigating history
            setOriginalInput(currentInput);
            setHistoryIndex(commandHistory.length - 1);
            setInput(commandHistory[commandHistory.length - 1]);
          } else if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            setInput(commandHistory[historyIndex - 1]);
          }
        }
      } else if (direction === 'down') {
        if (historyIndex >= 0) {
          if (historyIndex < commandHistory.length - 1) {
            setHistoryIndex(historyIndex + 1);
            setInput(commandHistory[historyIndex + 1]);
          } else {
            // Return to original input
            setHistoryIndex(-1);
            setInput(originalInput);
          }
        }
      }
    },
    [commandHistory, historyIndex, originalInput]
  );

  const resetHistoryNavigation = useCallback(() => {
    setHistoryIndex(-1);
    setOriginalInput('');
  }, []);

  const exitHistoryMode = useCallback(() => {
    setHistoryIndex(-1);
    setOriginalInput('');
  }, []);

  return {
    commandHistory,
    historyIndex,
    addToHistory,
    navigateHistory,
    resetHistoryNavigation,
    exitHistoryMode,
    isInHistoryMode: historyIndex >= 0,
  };
}
