import { useState, useCallback, useMemo, useEffect } from 'react';
import { Box, Text, useStdout, useInput } from 'ink';
import { ProviderManager } from '../providers/ProviderManager.js';
import { Message, ProviderType } from '../types/index.js';
import { InteractiveLoading } from './InteractiveLoading';
import { ChatLogger } from '../config/ChatLogger.js';
import { ConfigManager } from '../config/ConfigManager.js';

import { MessageList } from './MessageList';
import { FileSearch } from './FileSearch';
import { useInputHandler } from './useInputHandler';
import { useCommandHandler } from './useCommandHandler';
import { useHistoryNavigation } from './useHistoryNavigation';

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
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [chatLogger] = useState(() => new ChatLogger());

  // History navigation
  const { addToHistory, navigateHistory, resetHistoryNavigation } = useHistoryNavigation();

  // Ctrl+C handling state
  const [ctrlCCount, setCtrlCCount] = useState(0);
  const [ctrlCTimer, setCtrlCTimer] = useState<NodeJS.Timeout | null>(null);

  // Mode state
  const [currentMode, setCurrentMode] = useState<'code' | 'thinking'>('code');

  // File search state
  const [isFileSearchMode, setIsFileSearchMode] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ path: string; content: string }[]>([]);

  // Memory optimization constants (currently using inline limits)
  // const MAX_FILE_SEARCH_RESULTS = 50;
  // const MAX_ATTACHED_FILES = 10;

  // Get terminal dimensions for responsive design
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? process.stdout.columns ?? 80;
  const terminalHeight = stdout?.rows ?? process.stdout.rows ?? 24;

  // Determine if we're on a small screen (mobile-like)
  const isSmallScreen = terminalWidth < 60 || terminalHeight < 15;
  const isVerySmallScreen = terminalWidth < 40 || terminalHeight < 10;

  // Load initial theme from config and initialize chat logging
  useEffect(() => {
    const initializeApp = async () => {
      const configManager = new ConfigManager();
      await configManager.loadConfig();
      const config = configManager.getConfig();
      setTheme(config.theme);

      // Initialize chat logger and start session
      await chatLogger.initialize();
      await chatLogger.startSession(provider, model);
    };
    initializeApp();

    // Cleanup: end session when component unmounts
    return () => {
      chatLogger.endSession('completed').catch(console.warn);
    };
  }, [chatLogger, provider, model]);

  // Cleanup Ctrl+C timer on unmount
  useEffect(() => {
    return () => {
      if (ctrlCTimer) {
        clearTimeout(ctrlCTimer);
      }
    };
  }, [ctrlCTimer]);

  // Force immediate re-render when messages change to prevent buffering
  useEffect(() => {
    if (messages.length > 0) {
      // Force stdout flush to ensure immediate visibility
      process.stdout.write('\r');
    }
  }, [messages]);

  // Handle input and arrow key navigation for command history
  useInput((inputChar, key) => {
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

    // Handle tab key to toggle between thinking and code mode
    if (key.tab) {
      const newMode = currentMode === 'code' ? 'thinking' : 'code';
      chatLogger.logModeChanged(currentMode, newMode).catch(console.warn);
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

    // Regular input mode
    if (key.upArrow) {
      if (commandHistory.length > 0) {
        if (historyIndex === -1) {
          // Save current input before navigating history
          setOriginalInput(input);
          setHistoryIndex(commandHistory.length - 1);
          setInput(commandHistory[commandHistory.length - 1]);
        } else if (historyIndex > 0) {
          setHistoryIndex(historyIndex - 1);
          setInput(commandHistory[historyIndex - 1]);
        }
      }
    } else if (key.downArrow) {
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
    } else if (key.return) {
      // Handle enter key
      if (input.trim()) {
        sendMessage();
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
      if (historyIndex >= 0) {
        // If we're in history mode, exit it when user starts typing
        setHistoryIndex(-1);
        setOriginalInput('');
      }
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
    } else if (inputChar && !key.ctrl && !key.meta && inputChar.length === 1) {
      // Handle regular character input
      if (historyIndex >= 0) {
        // If we're in history mode, exit it when user starts typing
        setHistoryIndex(-1);
        setOriginalInput('');
      }

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
    }
  });

  const sendMessage = useCallback(
    async (value?: string) => {
      const inputValue = value ?? input;
      if (!inputValue.trim() || isLoading) return;

      const trimmedInput = inputValue.trim();

      // Add command to history before processing
      setCommandHistory(prev => {
        const newHistory = [...prev];
        if (newHistory[newHistory.length - 1] !== trimmedInput) {
          newHistory.push(trimmedInput);
        }
        return newHistory;
      });

      // Reset history navigation
      setHistoryIndex(-1);
      setOriginalInput('');

      // Handle special commands
      if (trimmedInput === '/verbose') {
        setIsVerbose(!isVerbose);
        await chatLogger.logCommand('/verbose', { enabled: !isVerbose });
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `Verbose mode ${!isVerbose ? 'enabled' : 'disabled'}`,
            timestamp: new Date(),
          },
        ]);
        setInput('');
        return;
      }

      if (trimmedInput === '/themes') {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        const configManager = new ConfigManager();
        configManager.setConfig('theme', newTheme);
        await chatLogger.logCommand('/themes', { from: theme, to: newTheme });
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `Theme switched to: ${newTheme}`,
            timestamp: new Date(),
          },
        ]);
        setInput('');
        return;
      }

      if (trimmedInput === '/clear') {
        await chatLogger.logCommand('/clear', { messageCount: messages.length });
        setMessages([]);
        setInput('');
        return;
      }

      if (trimmedInput === '/mode' || trimmedInput === '/thinking') {
        const newMode = currentMode === 'code' ? 'thinking' : 'code';
        await chatLogger.logModeChanged(currentMode, newMode);
        await chatLogger.logCommand(trimmedInput, { from: currentMode, to: newMode });
        setCurrentMode(newMode);
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `Switched to ${newMode} mode`,
            timestamp: new Date(),
          },
        ]);
        setInput('');
        return;
      }

      if (trimmedInput === '/compress') {
        if (messages.length === 0) {
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: 'No conversation history to compress.',
              timestamp: new Date(),
            },
          ]);
          setInput('');
          return;
        }

        await chatLogger.logCommand('/compress', { messageCount: messages.length });
        setInput('');
        setIsLoading(true);
        setError(null);

        try {
          // Create a summary prompt
          const conversationText = messages
            .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
            .join('\n\n');

          const summaryPrompt = `Please provide a concise summary of the following conversation. Focus on the key points, decisions made, and current context. Keep it brief but comprehensive enough to maintain continuity:

${conversationText}

Summary:`;

          const summaryMessage: Message = {
            role: 'user',
            content: summaryPrompt,
            timestamp: new Date(),
          };

          const response = await providerManager.sendMessage(
            provider,
            [summaryMessage],
            model,
            isVerbose
          );

          // Replace all messages with the summary
          const summaryAssistantMessage: Message = {
            role: 'assistant',
            content: `🗜️ Conversation compressed. Previous context summarized:\n\n${response.content}`,
            timestamp: new Date(),
          };

          setMessages([summaryAssistantMessage]);
        } catch (err) {
          await chatLogger.logError(
            err instanceof Error ? err : new Error('Failed to compress conversation')
          );
          setError(err instanceof Error ? err.message : 'Failed to compress conversation');
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // Build message content with attached files
      let messageContent = trimmedInput;
      if (attachedFiles.length > 0) {
        const fileContents = attachedFiles
          .map(file => `## File: ${file.path}\n\`\`\`\n${file.content}\n\`\`\`\n`)
          .join('\n');
        messageContent = `${fileContents}\n${trimmedInput}`;
      }

      const userMessage: Message = {
        role: 'user',
        content: messageContent,
        timestamp: new Date(),
      };

      // Log the message being sent
      await chatLogger.logMessageSent(
        userMessage,
        attachedFiles.length > 0 ? attachedFiles : undefined
      );

      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setAttachedFiles([]); // Clear attached files after sending
      setIsLoading(true);
      setError(null);

      const startTime = Date.now();

      try {
        if (isVerbose) {
          // Show that we're starting to send the message
          const thinkingMessage: Message = {
            role: 'assistant',
            content: '🤔 Thinking... (verbose mode enabled - streaming output)',
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, thinkingMessage]);
          // Force immediate render update
          process.stdout.write('');
        }

        const response = await providerManager.sendMessage(
          provider,
          [...messages, userMessage],
          model,
          isVerbose,
          currentMode
        );

        const responseTime = Date.now() - startTime;

        // Log the response received
        await chatLogger.logMessageReceived(response, responseTime);

        if (isVerbose) {
          // Remove the temporary thinking message and add the real response
          setMessages(prev => {
            const newMessages = [...prev];
            // Remove the last message if it was the thinking message
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
        const error = err instanceof Error ? err : new Error('Unknown error occurred');
        await chatLogger.logError(error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, isVerbose, messages, model, provider, providerManager]
  );

  // Memoize header to prevent unnecessary re-renders
  const headerText = useMemo(() => {
    const modeIndicator = currentMode === 'thinking' ? '[THINKING]' : '[CODE]';
    if (isVerySmallScreen) {
      return `🚀 ${provider} ${modeIndicator}`;
    } else if (isSmallScreen) {
      return `🚀 fosscode - ${provider} ${modeIndicator}`;
    }
    return `🚀 fosscode - ${provider} (${model}) ${modeIndicator}`;
  }, [provider, model, isSmallScreen, isVerySmallScreen, currentMode]);

  // Theme colors
  const themeColors = useMemo(
    () => ({
      header: theme === 'dark' ? 'cyan' : 'blue',
      userMessage: theme === 'dark' ? 'green' : 'green',
      assistantMessage: theme === 'dark' ? 'blue' : 'magenta',
      inputPrompt: theme === 'dark' ? 'yellow' : 'black',
      footer: theme === 'dark' ? 'gray' : 'gray',
      error: 'red',
    }),
    [theme]
  );

  // File attachment handler
  const handleFileAttach = useCallback((filePath: string, content: string) => {
    setAttachedFiles(prev => [
      ...prev,
      {
        path: filePath,
        content,
      },
    ]);
    setInput(prev => prev + filePath + ' ');
  }, []);

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box marginBottom={isVerySmallScreen ? 0 : 1}>
        <Text color={themeColors.header}>{headerText}</Text>
      </Box>

      {/* Messages */}
      <Box flexDirection="column" flexGrow={1} marginBottom={isVerySmallScreen ? 0 : 1}>
        <MessageList
          messages={messages}
          themeColors={themeColors}
          isVerySmallScreen={isVerySmallScreen}
        />

        {isLoading && <InteractiveLoading />}

        {error && (
          <Box>
            <Text color={themeColors.error}>{`🚨 Error: ${error}`}</Text>
          </Box>
        )}

        {/* File Search Interface */}
        <FileSearch
          isActive={isFileSearchMode}
          onFileAttach={handleFileAttach}
          onExit={() => setIsFileSearchMode(false)}
          themeColors={themeColors}
        />

        {/* Attached Files Indicator */}
        {attachedFiles.length > 0 && !isFileSearchMode && (
          <Box marginBottom={1}>
            <Text color={themeColors.inputPrompt}>
              {`📎 Attached: ${attachedFiles.map(f => f.path).join(', ')}`}
            </Text>
          </Box>
        )}
      </Box>

      {/* Input */}
      <Box alignItems="flex-start">
        <Text color={themeColors.inputPrompt}>{isVerySmallScreen ? '$ ' : '> '}</Text>
        <Text>
          {input || (
            <Text color={themeColors.footer}>
              {isVerySmallScreen
                ? 'Msg...'
                : isSmallScreen
                  ? `Type message... (${currentMode})`
                  : `Type your message... (${currentMode}) (Ctrl+C clear, Ctrl+C twice exit)`}
            </Text>
          )}
        </Text>
      </Box>

      {/* Footer - conditionally rendered based on screen size and chat state */}
      {messages.length === 0 && (
        <Box marginTop={1}>
          {isVerySmallScreen ? (
            <Text color={themeColors.footer}>Enter send • Ctrl+C clear • Ctrl+C×2 exit</Text>
          ) : (
            <>
              <Text color={themeColors.footer}>
                {isSmallScreen
                  ? 'Enter to send, Ctrl+C clear, Ctrl+C×2 exit'
                  : 'Type your message and press Enter to send, Ctrl+C clear, Ctrl+C×2 exit'}
              </Text>
              {!isSmallScreen && (
                <Text color={themeColors.footer}>
                  Commands: /verbose (toggle), /clear (clear), /compress (summarize), /themes
                  (switch), /mode (toggle) | Tab to toggle mode | ↑↓ for history
                </Text>
              )}
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
