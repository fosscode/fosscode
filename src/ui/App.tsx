import { useState, useCallback, useEffect } from 'react';
import { Box, useStdout, useInput } from 'ink';
import { ProviderManager } from '../providers/ProviderManager.js';
import { Message, ProviderType } from '../types/index.js';
import { useFileSearch } from './hooks/useFileSearch.js';
import { useCommandHistory } from './hooks/useCommandHistory.js';
import { useTheme } from './hooks/useTheme.js';
import { handleCommand, toggleMode } from './utils/commandHandler.js';
import { AppHeader } from './components/AppHeader.js';
import { MessageList } from './components/MessageList.js';
import { FileSearch } from './components/FileSearch.js';
import { AttachedFilesIndicator } from './components/AttachedFilesIndicator.js';
import { MessageInput } from './components/MessageInput.js';
import { AppFooter } from './components/AppFooter.js';

export { App };

interface AppProps {
  provider: ProviderType;
  model: string;
  providerManager: ProviderManager;
  onModelChange?: (newModel: string) => void;
  verbose?: boolean;
}

function App({ provider, model, providerManager, verbose = false }: AppProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerbose, setIsVerbose] = useState(verbose);
  const [currentMode, setCurrentMode] = useState<'code' | 'thinking'>('code');

  // Custom hooks
  const fileSearch = useFileSearch();
  const commandHistory = useCommandHistory();
  const { theme, toggleTheme, themeColors } = useTheme();

  // Get terminal dimensions for responsive design
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? process.stdout.columns ?? 80;
  const terminalHeight = stdout?.rows ?? process.stdout.rows ?? 24;

  // Determine if we're on a small screen (mobile-like)
  const isSmallScreen = terminalWidth < 60 || terminalHeight < 15;
  const isVerySmallScreen = terminalWidth < 40 || terminalHeight < 10;

  // Force immediate re-render when messages change to prevent buffering
  useEffect(() => {
    if (messages.length > 0) {
      process.stdout.write('\r');
    }
  }, [messages]);

  // Handle input and navigation
  useInput((inputChar, key) => {
    if (isLoading) return;

    // Allow Ctrl+C to exit
    if (key.ctrl && inputChar === 'c') {
      process.exit(0);
    }

    // Handle tab key to toggle between thinking and code mode
    if (key.tab) {
      const newMode = toggleMode(currentMode);
      setCurrentMode(newMode);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Switched to ${newMode} mode`,
          timestamp: new Date(),
        },
      ]);
      return;
    }

    // Handle file search mode
    if (fileSearch.isFileSearchMode) {
      if (key.escape) {
        fileSearch.exitFileSearch();
        return;
      }

      if (key.upArrow) {
        fileSearch.navigateFileResults('up');
        return;
      }

      if (key.downArrow) {
        fileSearch.navigateFileResults('down');
        return;
      }

      if (key.return) {
        fileSearch.selectCurrentFile();
        return;
      }

      if (key.backspace || key.delete) {
        if (fileSearch.fileSearchQuery.length > 0) {
          fileSearch.setFileSearchQuery(prev => prev.slice(0, -1));
        } else {
          fileSearch.exitFileSearch();
        }
        return;
      }

      if (inputChar && !key.ctrl && !key.meta && inputChar.length === 1) {
        fileSearch.setFileSearchQuery(prev => prev + inputChar);
        return;
      }

      return;
    }

    // Regular input mode
    if (key.upArrow) {
      const newInput = commandHistory.navigateHistory('up', input);
      setInput(newInput);
    } else if (key.downArrow) {
      const newInput = commandHistory.navigateHistory('down', input);
      setInput(newInput);
    } else if (key.return) {
      if (input.trim()) {
        sendMessage();
      }
    } else if (key.backspace || key.delete) {
      if (commandHistory.historyIndex >= 0) {
        commandHistory.exitHistoryMode();
      }
      const newInput = input.slice(0, -1);
      setInput(newInput);

      // Check if we need to exit file search mode
      if (newInput.endsWith('@')) {
        fileSearch.setIsFileSearchMode(true);
        fileSearch.setFileSearchQuery('');
      } else if (fileSearch.isFileSearchMode && !newInput.includes('@')) {
        fileSearch.exitFileSearch();
      }
    } else if (inputChar && !key.ctrl && !key.meta && inputChar.length === 1) {
      if (commandHistory.historyIndex >= 0) {
        commandHistory.exitHistoryMode();
      }

      const newInput = input + inputChar;
      setInput(newInput);

      // Check for @ symbol to enter file search mode
      if (inputChar === '@' && !fileSearch.isFileSearchMode) {
        fileSearch.setIsFileSearchMode(true);
        fileSearch.setFileSearchQuery('');
      }
    }
  });

  const sendMessage = useCallback(
    async (value?: string) => {
      const inputValue = value ?? input;
      if (!inputValue.trim() || isLoading) return;

      const trimmedInput = inputValue.trim();

      // Add command to history
      commandHistory.addToHistory(trimmedInput);
      commandHistory.resetHistoryNavigation();

      // Handle special commands
      const commandResult = await handleCommand(trimmedInput, {
        isVerbose,
        theme,
        currentMode,
        messages,
        provider,
        model,
        providerManager,
      });

      if (commandResult.type === 'message') {
        if (commandResult.message) {
          setMessages(prev => [...prev, commandResult.message!]);
        }

        // Handle state changes for specific commands
        if (trimmedInput === '/verbose') {
          setIsVerbose(!isVerbose);
        } else if (trimmedInput === '/themes') {
          toggleTheme();
        } else if (trimmedInput === '/mode' || trimmedInput === '/thinking') {
          setCurrentMode(toggleMode(currentMode));
        }
      } else if (commandResult.type === 'clear') {
        if (commandResult.shouldClearMessages) {
          setMessages(commandResult.message ? [commandResult.message] : []);
        }
      }

      if (commandResult.type !== 'none') {
        setInput('');
        return;
      }

      // Handle regular messages
      let messageContent = trimmedInput;
      if (fileSearch.attachedFiles.length > 0) {
        const fileContents = fileSearch.attachedFiles
          .map(file => `## File: ${file.path}\n\`\`\`\n${file.content}\n\`\`\`\n`)
          .join('\n');
        messageContent = `${fileContents}\n${trimmedInput}`;
      }

      const userMessage: Message = {
        role: 'user',
        content: messageContent,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, userMessage]);
      setInput('');
      fileSearch.setAttachedFiles([]); // Clear attached files after sending
      setIsLoading(true);
      setError(null);

      try {
        if (isVerbose) {
          const thinkingMessage: Message = {
            role: 'assistant',
            content: '🤔 Thinking... (verbose mode enabled - streaming output)',
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, thinkingMessage]);
          process.stdout.write('');
        }

        const response = await providerManager.sendMessage(
          provider,
          [...messages, userMessage],
          model,
          isVerbose,
          currentMode
        );

        if (isVerbose) {
          setMessages(prev => {
            const newMessages = [...prev];
            if (newMessages[newMessages.length - 1]?.content === '🤔 Thinking...') {
              newMessages.pop();
            }
            return [
              ...newMessages,
              {
                role: 'assistant',
                content: response.content,
                timestamp: new Date(),
              },
            ];
          });
        } else {
          const assistantMessage: Message = {
            role: 'assistant',
            content: response.content,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    },
    [
      input,
      isLoading,
      isVerbose,
      messages,
      model,
      provider,
      providerManager,
      currentMode,
      theme,
      fileSearch,
      commandHistory,
      toggleTheme,
    ]
  );

  return (
    <Box flexDirection="column" height="100%">
      <AppHeader
        provider={provider}
        model={model}
        currentMode={currentMode}
        isSmallScreen={isSmallScreen}
        isVerySmallScreen={isVerySmallScreen}
      />

      <MessageList
        messages={messages}
        isLoading={isLoading}
        error={error}
        isVerySmallScreen={isVerySmallScreen}
      />

      <FileSearch
        isVisible={fileSearch.isFileSearchMode}
        query={fileSearch.fileSearchQuery}
        results={fileSearch.fileSearchResults}
        selectedIndex={fileSearch.selectedFileIndex}
        isSearching={fileSearch.isSearchingFiles}
        themeColors={themeColors}
      />

      <AttachedFilesIndicator
        attachedFiles={fileSearch.attachedFiles}
        isFileSearchMode={fileSearch.isFileSearchMode}
      />

      <MessageInput
        input={input}
        currentMode={currentMode}
        isVerySmallScreen={isVerySmallScreen}
        isSmallScreen={isSmallScreen}
      />

      <AppFooter
        messagesLength={messages.length}
        isVerySmallScreen={isVerySmallScreen}
        isSmallScreen={isSmallScreen}
      />
    </Box>
  );
}
