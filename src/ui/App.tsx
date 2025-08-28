import { useState, useCallback, useMemo, useEffect } from 'react';
import { Box, Text, useStdout, useInput } from 'ink';
import { ProviderManager } from '../providers/ProviderManager.js';
import { Message, ProviderType } from '../types/index.js';
import { InteractiveLoading } from './InteractiveLoading';
import { ChatLogger } from '../config/ChatLogger.js';
import { ConfigManager } from '../config/ConfigManager.js';
import * as fs from 'fs';
import * as path from 'path';

import { MessageList } from './MessageList';
import { FileSearch } from './FileSearch';

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

  // Command history state
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [originalInput, setOriginalInput] = useState('');

  // Cursor position state
  const [cursorPosition, setCursorPosition] = useState(0);

  // Context window monitoring state
  const [contextSize, setContextSize] = useState(0);
  const [maxContextSize] = useState(128000); // Default max context for GPT-4
  const [lastResponseTokens, setLastResponseTokens] = useState(0);
  const [showContextWindow, setShowContextWindow] = useState(true);

  // Additional display state
  const [currentDirectory, setCurrentDirectory] = useState('');
  const [fosscodeVersion, setFosscodeVersion] = useState('');
  const [chatTopic, setChatTopic] = useState('');

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

      // Load version and current directory
      try {
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        setFosscodeVersion(packageJson.version || 'unknown');
      } catch (error) {
        setFosscodeVersion('unknown');
      }

      setCurrentDirectory(path.basename(process.cwd()));
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

    // Handle file search mode input
    if (isFileSearchMode) {
      // FileSearch handles its own input via useInput hook
      return;
    }

    // Handle Ctrl+C with double-tap detection
    if (key.ctrl && inputChar === 'c') {
      setCtrlCCount(prev => {
        const newCount = prev + 1;

        if (newCount === 1) {
          // First Ctrl+C: Clear the input
          setInput('');
          setCursorPosition(0);

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

    // Handle @ key to enter file search mode
    if (inputChar === '@' && !isFileSearchMode) {
      setIsFileSearchMode(true);
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
    if (key.leftArrow) {
      // Move cursor left
      setCursorPosition(prev => Math.max(0, prev - 1));
    } else if (key.rightArrow) {
      // Move cursor right
      setCursorPosition(prev => Math.min(input.length, prev + 1));
    } else if (key.upArrow) {
      if (commandHistory.length > 0) {
        if (historyIndex === -1) {
          // Save current input before navigating history
          setOriginalInput(input);
          setHistoryIndex(commandHistory.length - 1);
          setInput(commandHistory[commandHistory.length - 1]);
          setCursorPosition(commandHistory[commandHistory.length - 1].length);
        } else if (historyIndex > 0) {
          setHistoryIndex(historyIndex - 1);
          setInput(commandHistory[historyIndex - 1]);
          setCursorPosition(commandHistory[historyIndex - 1].length);
        }
      }
    } else if (key.downArrow) {
      if (historyIndex >= 0) {
        if (historyIndex < commandHistory.length - 1) {
          setHistoryIndex(historyIndex + 1);
          setInput(commandHistory[historyIndex + 1]);
          setCursorPosition(commandHistory[historyIndex + 1].length);
        } else {
          // Return to original input
          setHistoryIndex(-1);
          setInput(originalInput);
          setCursorPosition(originalInput.length);
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

      if (cursorPosition > 0) {
        const newInput = input.slice(0, cursorPosition - 1) + input.slice(cursorPosition);
        setInput(newInput);
        setCursorPosition(prev => prev - 1);
      }

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

      const newInput = input.slice(0, cursorPosition) + inputChar + input.slice(cursorPosition);
      setInput(newInput);
      setCursorPosition(prev => prev + 1);

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
        setCursorPosition(0);
        return;
      }

      if (trimmedInput === '/context') {
        setShowContextWindow(!showContextWindow);
        await chatLogger.logCommand('/context', { enabled: !showContextWindow });
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `Context window display ${!showContextWindow ? 'enabled' : 'disabled'}`,
            timestamp: new Date(),
          },
        ]);
        setInput('');
        setCursorPosition(0);
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
      setCursorPosition(0);
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

        // Update context size with actual token usage
        if (response.usage) {
          setLastResponseTokens(response.usage.totalTokens);
          setContextSize(response.usage.totalTokens);
        }

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
  const handleFileAttach = useCallback(
    (filePath: string, content: string) => {
      setAttachedFiles(prev => [
        ...prev,
        {
          path: filePath,
          content,
        },
      ]);
      const newInput =
        input.slice(0, cursorPosition) + filePath + ' ' + input.slice(cursorPosition);
      setInput(newInput);
      setCursorPosition(prev => prev + filePath.length + 1);
    },
    [input, cursorPosition]
  );

  // Helper function to render input with cursor
  const renderInputWithCursor = useCallback((text: string, cursorPos: number) => {
    if (text.length === 0) return '';

    const beforeCursor = text.slice(0, cursorPos);
    const afterCursor = text.slice(cursorPos);
    return `${beforeCursor}█${afterCursor}`;
  }, []);

  // Calculate context size based on messages (fallback when no API usage data)
  const calculateContextSize = useCallback((messages: Message[]) => {
    // Rough estimation: ~4 characters per token
    const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    const estimatedTokens = Math.ceil(totalChars / 4);
    return estimatedTokens;
  }, []);

  // Update context size when messages change (fallback)
  useEffect(() => {
    // Only use estimation if we don't have actual token data
    if (contextSize === 0 || lastResponseTokens === 0) {
      const newContextSize = calculateContextSize(messages);
      setContextSize(newContextSize);
    }
  }, [messages, calculateContextSize, contextSize, lastResponseTokens]);

  // Generate chat topic summary
  const generateChatTopic = useCallback((messages: Message[]) => {
    if (messages.length === 0) return 'New conversation';

    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) return 'Assistant mode';

    const firstMessage = userMessages[0].content.slice(0, 50);
    const topic =
      firstMessage.length < userMessages[0].content.length ? `${firstMessage}...` : firstMessage;

    return topic;
  }, []);

  // Update chat topic when messages change
  useEffect(() => {
    const topic = generateChatTopic(messages);
    setChatTopic(topic);
  }, [messages, generateChatTopic]);

  return (
    <Box flexDirection="column" height="100%">
      {/* Top Bar with Directory, Version, and Context */}
      <Box marginBottom={isVerySmallScreen ? 0 : 1}>
        <Box justifyContent="space-between" alignItems="center">
          <Box>
            <Text color={themeColors.header}>
              {headerText}
              {!isVerySmallScreen && (
                <Text color={themeColors.footer}>
                  {' '}
                  | 📁 {currentDirectory} | v{fosscodeVersion}
                </Text>
              )}
            </Text>
          </Box>
          {!isVerySmallScreen && showContextWindow && (
            <Box>
              <Text
                color={
                  contextSize > maxContextSize * 0.8
                    ? 'red'
                    : contextSize > maxContextSize * 0.6
                      ? 'yellow'
                      : themeColors.footer
                }
              >
                📊 {contextSize.toLocaleString()}/{maxContextSize.toLocaleString()} tokens (
                {Math.round((contextSize / maxContextSize) * 100)}%)
              </Text>
            </Box>
          )}
        </Box>
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

      {/* Bottom Bar with Model and Chat Topic */}
      {!isVerySmallScreen && (
        <Box marginTop={1}>
          <Box justifyContent="space-between" alignItems="center">
            <Box>
              <Text color={themeColors.footer}>🤖 {model}</Text>
            </Box>
            <Box>
              <Text color={themeColors.footer}>💬 {chatTopic}</Text>
            </Box>
          </Box>
        </Box>
      )}

      {/* Input */}
      <Box alignItems="flex-start">
        <Text color={themeColors.inputPrompt}>{isVerySmallScreen ? '$ ' : '> '}</Text>
        <Text>
          {input ? (
            <Text>{renderInputWithCursor(input, cursorPosition)}</Text>
          ) : (
            <Text color={themeColors.footer}>
              {isVerySmallScreen
                ? 'Msg...'
                : isSmallScreen
                  ? `Type message... (${currentMode})`
                  : `Type your message... (${currentMode}) (Ctrl+C clear, Ctrl+C twice exit)`}
            </Text>
          )}
        </Text>
        {/* Context window indicator for small screens */}
        {isVerySmallScreen && showContextWindow && (
          <Box marginLeft={1}>
            <Text
              color={
                contextSize > maxContextSize * 0.8
                  ? 'red'
                  : contextSize > maxContextSize * 0.6
                    ? 'yellow'
                    : themeColors.footer
              }
            >
              {Math.round((contextSize / maxContextSize) * 100)}%
            </Text>
          </Box>
        )}
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
                  (switch), /mode (toggle), /context (toggle display) | Tab to toggle mode | ↑↓ for
                  history
                </Text>
              )}
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
