import { useState, useCallback } from 'react';

interface InputHandlerOptions {
  onSendMessage: (message?: string) => void;
  onFileSearchEnter: () => void;
  onFileSearchExit: () => void;
  onModeToggle: () => void;
  onFileSearchInput: (inputChar: string, key: any) => void;
  isLoading: boolean;
  isFileSearchMode: boolean;
}

export function useInputHandler({
  onSendMessage,
  onFileSearchEnter,
  onFileSearchExit,
  onModeToggle,
  onFileSearchInput,
  isLoading,
  isFileSearchMode,
}: InputHandlerOptions) {
  const [input, setInput] = useState('');
  const [ctrlCCount, setCtrlCCount] = useState(0);
  const [ctrlCTimer, setCtrlCTimer] = useState<NodeJS.Timeout | null>(null);

  const handleInput = useCallback(
    (inputChar: string, key: any) => {
      if (isLoading) return;

      // Handle Ctrl+C with double-tap detection
      if (key.ctrl && inputChar === 'c') {
        setCtrlCCount(prev => {
          const newCount = prev + 1;

          if (newCount === 1) {
            // First Ctrl+C: Clear the input
            setInput('');

            // Start timer for double-tap detection
            const timer = setTimeout(() => {
              setCtrlCCount(0);
              setCtrlCTimer(null);
            }, 1000); // 1 second window for double Ctrl+C

            setCtrlCTimer(timer);
            return newCount;
          } else if (newCount === 2) {
            // Second Ctrl+C: Exit the application
            if (ctrlCTimer) {
              clearTimeout(ctrlCTimer);
              setCtrlCTimer(null);
            }
            process.exit(0);
          }

          return newCount;
        });
        return;
      }

      // Handle Tab key to toggle between thinking and code mode
      if (key.tab) {
        onModeToggle();
        return;
      }

      // Handle file search mode
      if (isFileSearchMode) {
        onFileSearchInput(inputChar, key);
        return;
      }

      // Regular input mode
      if (key.return) {
        // Handle enter key
        if (input.trim()) {
          onSendMessage();
        }

        // Reset Ctrl+C counter on enter
        if (ctrlCCount > 0) {
          setCtrlCCount(0);
          if (ctrlCTimer) {
            clearTimeout(ctrlCTimer);
            setCtrlCTimer(null);
          }
        }
      } else if (key.backspace || key.delete) {
        // Handle backspace
        const newInput = input.slice(0, -1);
        setInput(newInput);

        // Reset Ctrl+C counter on any input
        if (ctrlCCount > 0) {
          setCtrlCCount(0);
          if (ctrlCTimer) {
            clearTimeout(ctrlCTimer);
            setCtrlCTimer(null);
          }
        }

        // Check if we need to exit file search mode
        if (newInput.endsWith('@')) {
          onFileSearchEnter();
        } else if (isFileSearchMode && !newInput.includes('@')) {
          onFileSearchExit();
        }
      } else if (inputChar && !key.ctrl && !key.meta && inputChar.length === 1) {
        // Handle regular character input
        const newInput = input + inputChar;
        setInput(newInput);

        // Reset Ctrl+C counter on any input
        if (ctrlCCount > 0) {
          setCtrlCCount(0);
          if (ctrlCTimer) {
            clearTimeout(ctrlCTimer);
            setCtrlCTimer(null);
          }
        }

        // Check for @ symbol to enter file search mode
        if (inputChar === '@' && !isFileSearchMode) {
          onFileSearchEnter();
        }
      }
    },
    [
      input,
      isLoading,
      isFileSearchMode,
      ctrlCCount,
      ctrlCTimer,
      onSendMessage,
      onModeToggle,
      onFileSearchInput,
      onFileSearchEnter,
      onFileSearchExit,
    ]
  );

  const setInputValue = useCallback((value: string) => {
    setInput(value);
  }, []);

  const clearInput = useCallback(() => {
    setInput('');
  }, []);

  return {
    input,
    setInput: setInputValue,
    clearInput,
    handleInput,
  };
}
