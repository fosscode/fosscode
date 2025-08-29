import { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, useStdout, useInput } from 'ink';
import { ProviderManager } from '../providers/ProviderManager.js';
import { Message, ProviderType } from '../types/index.js';
import { ChatLogger } from '../config/ChatLogger.js';
import { useFileSearch } from './hooks/useFileSearch.js';
import { useCommandHistory } from './hooks/useCommandHistory.js';
import { useTheme } from './hooks/useTheme.js';
import { handleCommand, toggleMode } from './utils/commandHandler.js';
import {
  getEffectiveTerminalSize,
  getTmuxResponsiveBreakpoints,
  isInTmux,
} from '../utils/tmuxUtils.js';
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
  chatLogger: ChatLogger;
  onModelChange?: (newModel: string) => void;
  verbose?: boolean;
}

function App({
  provider,
  model,
  providerManager,
  chatLogger: _chatLogger,
  verbose = false,
}: AppProps) {
  // Note: chatLogger is used for session management, initialized in ChatCommand
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

  // Get terminal dimensions for responsive design (tmux-aware)
  const { stdout } = useStdout();

  // Use tmux-aware dimensions when available
  const effectiveDimensions = useMemo(() => {
    if (isInTmux()) {
      return getEffectiveTerminalSize();
    }
    return {
      width: stdout?.columns ?? process.stdout.columns ?? 80,
      height: stdout?.rows ?? process.stdout.rows ?? 24,
    };
  }, [stdout]);

  const terminalWidth = effectiveDimensions.width;
  const terminalHeight = effectiveDimensions.height;

  // Get tmux-aware responsive breakpoints
  const responsiveBreakpoints = useMemo(() => {
    if (isInTmux()) {
      return getTmuxResponsiveBreakpoints();
    }
    return {
      isSmallScreen: terminalWidth < 60 || terminalHeight < 15,
      isVerySmallScreen: terminalWidth < 40 || terminalHeight < 10,
      isExtraSmallScreen: false, // Not used in non-tmux mode
    };
  }, [terminalWidth, terminalHeight]);

  const isSmallScreen = responsiveBreakpoints.isSmallScreen;
  const isVerySmallScreen = responsiveBreakpoints.isVerySmallScreen;

  // Force immediate re-render when messages change to prevent buffering
  useEffect(() => {
    if (messages.length > 0) {
      // Removed stdout.write() as it interferes with Ink rendering
      // Ink handles re-rendering automatically
    }
  }, [messages]);

  // Limit message history to prevent memory issues and rendering performance problems
  const maxMessages = 100; // Keep last 100 messages
  useEffect(() => {
    if (messages.length > maxMessages) {
      setMessages(prev => prev.slice(-maxMessages));
    }
  }, [messages.length]);

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
          // Removed stdout.write('') as it interferes with Ink rendering
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
