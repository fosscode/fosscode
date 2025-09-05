import { useState, useCallback, useEffect } from 'react';
import { Box, useInput } from 'ink';
import { ProviderManager } from '../providers/ProviderManager.js';
import { Message, ProviderType } from '../types/index.js';
import { ChatLogger } from '../config/ChatLogger.js';
import { useFileSearch } from './hooks/useFileSearch.js';
import { useCommandHistory } from './hooks/useCommandHistory.js';
import { usePromptHistory } from './hooks/usePromptHistory.js';
import { useTheme } from './hooks/useTheme.js';
import { useTmux } from './hooks/useTmux.js';
import { handleCommand, toggleMode } from './utils/commandHandler.js';
import {
  isInTmux,
  loadChatHistoryFromSession,
  saveChatHistoryToSession,
  cleanupOldSessionFiles,
} from '../utils/tmuxUtils.js';
import { AppHeader } from './components/AppHeader.js';
import { MessageList } from './components/MessageList.js';
import { FileSearch } from './components/FileSearch.js';
import { AttachedFilesIndicator } from './components/AttachedFilesIndicator.js';
import { MessageInput } from './components/MessageInput.js';
import { AppFooter } from './components/AppFooter.js';
import { summarize } from '../utils/contextUtils.js';
import { getContextLimit } from '../utils/contextLimits.js';
import { PermissionManager } from '../utils/PermissionManager.js';

export { App };

interface AppProps {
  provider: ProviderType;
  model: string;
  providerManager: ProviderManager;
  chatLogger: ChatLogger;
  onModelChange?: (newModel: string) => void;
  verbose?: boolean;
  showThinkingBlocks?: boolean;
  permissionManager: PermissionManager;
}

function App({
  provider,
  model,
  providerManager,
  chatLogger: _chatLogger,
  verbose = false,
  showThinkingBlocks = true,
  permissionManager,
}: AppProps) {
  // Note: chatLogger is used for session management, initialized in ChatCommand
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerbose, setIsVerbose] = useState(verbose);
  const [currentMode, setCurrentMode] = useState<'code' | 'thinking'>('code');
  const [totalTokenUsage, setTotalTokenUsage] = useState({
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  });

  // Custom hooks
  const fileSearch = useFileSearch();
  const commandHistory = useCommandHistory();
  const promptHistory = usePromptHistory();
  const { theme, toggleTheme, themeColors } = useTheme();
  const tmux = useTmux();

  // Terminal dimensions are handled by the useTmux hook

  // Use tmux-aware responsive breakpoints
  const responsiveBreakpoints = tmux.responsiveBreakpoints;

  // Dimensions are now handled by the useTmux hook

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

  // Load chat history from tmux session on mount
  useEffect(() => {
    if (isInTmux()) {
      const sessionHistory = loadChatHistoryFromSession();
      if (sessionHistory) {
        setMessages(sessionHistory);
      }
      // Clean up old session files periodically
      cleanupOldSessionFiles();
    }
  }, []);

  // Tmux resize handling is now handled by the useTmux hook

  // Update tmux status line when mode/provider changes
  useEffect(() => {
    tmux.updateStatusLine(currentMode, provider, model);
    return () => {
      tmux.clearStatusLine();
    };
  }, [currentMode, provider, model, tmux]);

  // Set up tmux key bindings
  useEffect(() => {
    if (!tmux.isInTmux) return;

    const keyBindings = {
      'C-t': 'toggle-mode',
      'C-s': 'save-session',
      'C-l': 'clear-messages',
      'C-h': 'show-help',
    };

    tmux.setupKeyBindings(keyBindings);

    // Set up key binding listener
    const unsubscribeKeyBindings = tmux.onKeyBinding((_key, action) => {
      switch (action) {
        case 'toggle-mode':
          const newMode = toggleMode(currentMode);
          setCurrentMode(newMode);
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: `Switched to ${newMode} mode (via tmux key binding)`,
              timestamp: new Date(),
            },
          ]);
          break;
        case 'save-session':
          if (saveChatHistoryToSession(messages)) {
            setMessages(prev => [
              ...prev,
              {
                role: 'assistant',
                content: 'Chat history saved to tmux session',
                timestamp: new Date(),
              },
            ]);
          }
          break;
        case 'clear-messages':
          setMessages([]);
          // Reset token usage when clearing messages
          setTotalTokenUsage({
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          });
          break;
        case 'show-help':
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content:
                'Tmux Key Bindings:\n• Ctrl+T: Toggle mode\n• Ctrl+S: Save session\n• Ctrl+L: Clear messages\n• Ctrl+H: Show help',
              timestamp: new Date(),
            },
          ]);
          break;
      }
    });

    return () => {
      unsubscribeKeyBindings();
      // Key bindings are automatically cleaned up by tmux
    };
  }, [currentMode, messages]);

  // Save chat history to tmux session when messages change
  useEffect(() => {
    if (isInTmux() && messages.length > 0) {
      saveChatHistoryToSession(messages);
    }
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear any pending timers or intervals
      setIsLoading(false);
      setError(null);
      tmux.clearStatusLine();
    };
  }, []);

  // Handle input and navigation
  useInput((inputChar, key) => {
    try {
      if (isLoading) return;

      // Debug logging for input issues (only in verbose mode)
      if (process.env.DEBUG_INPUT && inputChar) {
        console.log(
          `Input received: "${inputChar}" (length: ${inputChar.length}, charCode: ${inputChar.charCodeAt(0)})`
        );
      }

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
        } else if (inputChar === ' ' && !key.ctrl && !key.meta) {
          // Explicit handling for space character in file search mode
          fileSearch.setFileSearchQuery(prev => prev + ' ');
          return;
        }

        return;
      }

      // Regular input mode
      if (key.upArrow) {
        const newInput = promptHistory.navigateHistory('up', input);
        setInput(newInput);
      } else if (key.downArrow) {
        const newInput = promptHistory.navigateHistory('down', input);
        setInput(newInput);
      } else if (key.return) {
        if (input.trim()) {
          sendMessage();
        }
      } else if (key.backspace || key.delete) {
        if (promptHistory.historyIndex >= 0) {
          promptHistory.exitHistoryMode();
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
        if (promptHistory.historyIndex >= 0) {
          promptHistory.exitHistoryMode();
        }

        const newInput = input + inputChar;
        setInput(newInput);

        // Check for @ symbol to enter file search mode
        if (inputChar === '@' && !fileSearch.isFileSearchMode) {
          fileSearch.setIsFileSearchMode(true);
          fileSearch.setFileSearchQuery('');
        }
      } else if (inputChar === ' ' && !key.ctrl && !key.meta) {
        // Explicit handling for space character to ensure it's captured
        if (promptHistory.historyIndex >= 0) {
          promptHistory.exitHistoryMode();
        }

        const newInput = input + ' ';
        setInput(newInput);
      }
    } catch (error) {
      // Handle raw mode errors gracefully
      if (
        error instanceof Error &&
        (error.message.includes('Raw mode') || error.message.includes('raw mode'))
      ) {
        console.log('\n❌ Interactive mode not supported in this environment');
        console.log('💡 Try using: fosscode chat "your message" --non-interactive');
        process.exit(1);
      }
      // Re-throw other errors
      throw error;
    }
  });

  const sendMessage = useCallback(
    async (value?: string) => {
      const inputValue = value ?? input;
      if (!inputValue.trim() || isLoading) return;

      const trimmedInput = inputValue.trim();

      // Add command to both in-memory and persistent history
      commandHistory.addToHistory(trimmedInput);
      commandHistory.resetHistoryNavigation();
      await promptHistory.addToHistory(trimmedInput);
      promptHistory.resetHistoryNavigation();

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
        const normalizedInput = trimmedInput.toLowerCase();
        if (normalizedInput === '/verbose') {
          setIsVerbose(!isVerbose);
        } else if (normalizedInput === '/themes') {
          toggleTheme();
        } else if (normalizedInput === '/mode' || normalizedInput === '/thinking') {
          setCurrentMode(toggleMode(currentMode));
        }
      } else if (commandResult.type === 'clear') {
        if (commandResult.shouldClearMessages) {
          setMessages(commandResult.message ? [commandResult.message] : []);
          // Reset token usage when clearing messages
          setTotalTokenUsage({
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          });
        }
      }

      if (commandResult.type !== 'none') {
        setInput('');
        return;
      }

      // Auto-summarization logic
      const lastMessage = messages.filter(x => x.role === 'assistant').at(-1);
      let currentMessages = messages;

      if (lastMessage && lastMessage.usage) {
        const modelContextLimit = getContextLimit(provider, model) ?? 8192;
        const outputLimit = 4096;
        const threshold = Math.max((modelContextLimit - outputLimit) * 0.9, 0);

        if (lastMessage.usage.totalTokens > threshold) {
          setIsLoading(true);
          setError(null);
          try {
            const summaryMessage = await summarize(
              messages,
              provider,
              model,
              providerManager.sendMessage.bind(providerManager)
            );
            currentMessages = [summaryMessage];
            setMessages(currentMessages);

            // Reset token usage when summarizing (new conversation context)
            setTotalTokenUsage({
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
            });
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error occurred');
          } finally {
            setIsLoading(false);
          }
        }
      }

      // Handle regular messages
      let messageContent = trimmedInput;
      if (fileSearch.attachedFiles.length > 0) {
        const fileContents = fileSearch.attachedFiles
          .map(file => `## File: ${file.path}\n\n${file.content}\n`)
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
        }

        const response = await providerManager.sendMessage(
          provider,
          [...currentMessages, userMessage],
          model,
          isVerbose,
          currentMode,
          _chatLogger,
          permissionManager
        );

        if (isVerbose) {
          setMessages(prev => {
            const newMessages = [...prev];
            if (newMessages[newMessages.length - 1]?.content === '🤔 Thinking...') {
              newMessages.pop();
            }
            const assistantMessage: Message = {
              role: 'assistant',
              content: response.content,
              timestamp: new Date(),
              ...(response.usage && { usage: response.usage }),
            };

            // Accumulate token usage
            if (response.usage) {
              setTotalTokenUsage(prev => ({
                promptTokens: prev.promptTokens + response.usage!.promptTokens,
                completionTokens: prev.completionTokens + response.usage!.completionTokens,
                totalTokens: prev.totalTokens + response.usage!.totalTokens,
              }));
            }

            return [...newMessages, assistantMessage];
          });
        } else {
          const assistantMessage: Message = {
            role: 'assistant',
            content: response.content,
            timestamp: new Date(),
            ...(response.usage && { usage: response.usage }),
          };
          setMessages(prev => [...prev, assistantMessage]);

          // Accumulate token usage
          if (response.usage) {
            setTotalTokenUsage(prev => ({
              promptTokens: prev.promptTokens + response.usage!.promptTokens,
              completionTokens: prev.completionTokens + response.usage!.completionTokens,
              totalTokens: prev.totalTokens + response.usage!.totalTokens,
            }));
          }
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
      promptHistory,
      toggleTheme,
      permissionManager,
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
        showThinkingBlocks={showThinkingBlocks}
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
        totalTokenUsage={totalTokenUsage}
      />
    </Box>
  );
}
