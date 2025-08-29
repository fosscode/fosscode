import { useState, useCallback, useEffect } from 'react';
import { PromptHistoryManager } from '../../utils/PromptHistoryManager.js';

export function usePromptHistory() {
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [originalInput, setOriginalInput] = useState('');
  const [manager] = useState(() => new PromptHistoryManager());

  // Initialize prompt history manager on mount
  useEffect(() => {
    const initializeHistory = async () => {
      try {
        await manager.initialize();
        const history = manager.getHistory();
        setPromptHistory(history);
      } catch (error) {
        console.error('Failed to initialize prompt history:', error);
      }
    };

    initializeHistory();
  }, [manager]);

  const addToHistory = useCallback(
    async (prompt: string) => {
      try {
        await manager.addPrompt(prompt);
        const updatedHistory = manager.getHistory();
        setPromptHistory(updatedHistory);
      } catch (error) {
        console.error('Failed to add prompt to history:', error);
      }
    },
    [manager]
  );

  const navigateHistory = useCallback(
    (direction: 'up' | 'down', currentInput: string) => {
      if (direction === 'up') {
        if (promptHistory.length > 0) {
          if (historyIndex === -1) {
            // Save current input before navigating history
            setOriginalInput(currentInput);
            setHistoryIndex(promptHistory.length - 1);
            return promptHistory[promptHistory.length - 1];
          } else if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            return promptHistory[historyIndex - 1];
          }
        }
      } else if (direction === 'down') {
        if (historyIndex >= 0) {
          if (historyIndex < promptHistory.length - 1) {
            setHistoryIndex(historyIndex + 1);
            return promptHistory[historyIndex + 1];
          } else {
            // Return to original input
            setHistoryIndex(-1);
            return originalInput;
          }
        }
      }
      return currentInput;
    },
    [promptHistory, historyIndex, originalInput]
  );

  const resetHistoryNavigation = useCallback(() => {
    setHistoryIndex(-1);
    setOriginalInput('');
  }, []);

  const exitHistoryMode = useCallback(() => {
    setHistoryIndex(-1);
    setOriginalInput('');
  }, []);

  const clearHistory = useCallback(async () => {
    try {
      await manager.clearHistory();
      setPromptHistory([]);
      resetHistoryNavigation();
    } catch (error) {
      console.error('Failed to clear prompt history:', error);
    }
  }, [manager, resetHistoryNavigation]);

  return {
    promptHistory,
    historyIndex,
    originalInput,
    addToHistory,
    navigateHistory,
    resetHistoryNavigation,
    exitHistoryMode,
    clearHistory,
  };
}
