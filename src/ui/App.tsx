import { useState, useCallback, useMemo, useEffect } from 'react';
import { Box, Text, useStdout, useInput } from 'ink';
import { ProviderManager } from '../providers/ProviderManager.js';
import { Message, ProviderType } from '../types/index.js';
import { InteractiveLoading } from './InteractiveLoading';
import { ConfigManager } from '../config/ConfigManager.js';
import { ReadTool } from '../tools/ReadTool.js';
import { BashTool } from '../tools/BashTool.js';
import { FlashyText } from './FlashyText.js';

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

  // History navigation state
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [originalInput, setOriginalInput] = useState('');

  // Mode state
  const [currentMode, setCurrentMode] = useState<'code' | 'thinking'>('code');

  // File search state
  const [isFileSearchMode, setIsFileSearchMode] = useState(false);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [fileSearchResults, setFileSearchResults] = useState<any[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [attachedFiles, setAttachedFiles] = useState<{ path: string; content: string }[]>([]);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isSearchingFiles, setIsSearchingFiles] = useState(false);

  // Get terminal dimensions for responsive design
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? process.stdout.columns ?? 80;
  const terminalHeight = stdout?.rows ?? process.stdout.rows ?? 24;

  // Determine if we're on a small screen (mobile-like)
  const isSmallScreen = terminalWidth < 60 || terminalHeight < 15;
  const isVerySmallScreen = terminalWidth < 40 || terminalHeight < 10;

  // Load initial theme from config
  useEffect(() => {
    const loadTheme = async () => {
      const configManager = new ConfigManager();
      await configManager.loadConfig();
      const config = configManager.getConfig();
      setTheme(config.theme);
    };
    loadTheme();
  }, []);

  // Force immediate re-render when messages change to prevent buffering
  useEffect(() => {
    if (messages.length > 0) {
      // Force stdout flush to ensure immediate visibility
      process.stdout.write('\r');
    }
  }, [messages]);

  // Debounce file search queries to prevent excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(fileSearchQuery);
    }, 300); // 300ms debounce delay

    return () => clearTimeout(timer);
  }, [fileSearchQuery]);

  // Perform search when debounced query changes
  useEffect(() => {
    if (isFileSearchMode) {
      setIsSearchingFiles(true);
      performFileSearch(debouncedSearchQuery).finally(() => {
        setIsSearchingFiles(false);
      });
    }
  }, [debouncedSearchQuery, isFileSearchMode]);

  // File search functions
  const performFileSearch = useCallback(async (query: string): Promise<void> => {
    try {
      const bashTool = new BashTool();

      // Check if we're in a git repository
      const gitCheck = await bashTool.execute({
        command: 'git rev-parse --git-dir > /dev/null 2>&1 && echo "git" || echo "no-git"',
        cwd: process.cwd(),
        timeout: 2000,
      });

      const isGitRepo = gitCheck.success && gitCheck.data?.stdout.trim() === 'git';

      if (!query.trim()) {
        // If no query, show recent files or common files
        let gitFiles: string[] = [];
        let taskFiles: string[] = [];

        if (isGitRepo) {
          // Use git ls-files to respect .gitignore
          const gitResult = await bashTool.execute({
            command: 'git ls-files | grep -E "\\.(ts|js|tsx|jsx|json|md)$"',
            cwd: process.cwd(),
            timeout: 5000,
          });
          if (gitResult.success && gitResult.data) {
            gitFiles = gitResult.data.stdout.split('\n').filter((f: string) => f.trim());
          }
        } else {
          // Fallback to find command
          const findResult = await bashTool.execute({
            command:
              'find . -type f -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" -o -name "*.json" -o -name "*.md"',
            cwd: process.cwd(),
            timeout: 5000,
          });
          if (findResult.success && findResult.data) {
            gitFiles = findResult.data.stdout.split('\n').filter((f: string) => f.trim());
          }
        }

        // Always include files from tasks directory
        const taskCommand = 'find ./tasks -type f 2>/dev/null || true';
        const taskResult = await bashTool.execute({
          command: taskCommand,
          cwd: process.cwd(),
          timeout: 3000,
        });
        if (taskResult.success && taskResult.data) {
          taskFiles = taskResult.data.stdout.split('\n').filter((f: string) => f.trim());
        }

        // Combine and deduplicate files
        const allFiles = [...gitFiles, ...taskFiles]
          .filter((file, index, arr) => arr.indexOf(file) === index)
          .slice(0, 20);

        const fileItems = allFiles.map((file: string) => ({
          name: file,
          type: 'file' as const,
          size: 0,
          modified: new Date().toISOString(),
        }));
        setFileSearchResults(fileItems);
        setSelectedFileIndex(0);
      } else {
        // Use git-aware search with pattern
        const escapedQuery = query.replace(/'/g, "'\\''"); // Escape single quotes
        let gitFiles: string[] = [];
        let taskFiles: string[] = [];

        if (isGitRepo) {
          // Use git ls-files with grep to respect .gitignore
          const gitResult = await bashTool.execute({
            command: `git ls-files | grep -i "${escapedQuery}"`,
            cwd: process.cwd(),
            timeout: 5000,
          });
          if (gitResult.success && gitResult.data) {
            gitFiles = gitResult.data.stdout.split('\n').filter((f: string) => f.trim());
          }
        } else {
          // Fallback to find command
          const findResult = await bashTool.execute({
            command: `find . -type f -iname "*${escapedQuery}*" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./dist/*" -not -path "./build/*"`,
            cwd: process.cwd(),
            timeout: 5000,
          });
          if (findResult.success && findResult.data) {
            gitFiles = findResult.data.stdout.split('\n').filter((f: string) => f.trim());
          }
        }

        // Always include matching files from tasks directory
        const taskCommand = `find ./tasks -type f -iname "*${escapedQuery}*" 2>/dev/null || true`;
        const taskResult = await bashTool.execute({
          command: taskCommand,
          cwd: process.cwd(),
          timeout: 3000,
        });
        if (taskResult.success && taskResult.data) {
          taskFiles = taskResult.data.stdout.split('\n').filter((f: string) => f.trim());
        }

        // Combine and deduplicate files
        const allFiles = [...gitFiles, ...taskFiles]
          .filter((file, index, arr) => arr.indexOf(file) === index)
          .slice(0, 20);

        const fileItems = allFiles.map((file: string) => ({
          name: file,
          type: 'file' as const,
          size: 0,
          modified: new Date().toISOString(),
        }));
        setFileSearchResults(fileItems);
        setSelectedFileIndex(0);
      }
    } catch (error) {
      setFileSearchResults([]);
    }
  }, []);

  const attachFile = useCallback(async (file: any) => {
    try {
      const readTool = new ReadTool();
      const result = await readTool.execute({
        filePath: file.name,
        withLineNumbers: true,
      });

      if (result.success && result.data) {
        const fileContent = result.data.content;
        setAttachedFiles(prev => [
          ...prev,
          {
            path: file.name,
            content: fileContent,
          },
        ]);

        // Exit file search mode
        setIsFileSearchMode(false);
        setFileSearchQuery('');
        setFileSearchResults([]);
        setSelectedFileIndex(0);

        // Add file reference to input
        setInput(prev => prev + file.name + ' ');
      }
    } catch (error) {
      // Handle error silently for now
    }
  }, []);

  // Handle input and arrow key navigation for command history
  useInput((inputChar, key) => {
    if (isLoading) return;

    // Allow Ctrl+C to exit
    if (key.ctrl && inputChar === 'c') {
      process.exit(0);
    }

    // Handle tab key to toggle between thinking and code mode
    if (key.tab) {
      const newMode = currentMode === 'code' ? 'thinking' : 'code';
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
    if (isFileSearchMode) {
      if (key.escape) {
        // Exit file search mode
        setIsFileSearchMode(false);
        setFileSearchQuery('');
        setFileSearchResults([]);
        setSelectedFileIndex(0);
        return;
      }

      if (key.upArrow) {
        setSelectedFileIndex(prev => (prev > 0 ? prev - 1 : fileSearchResults.length - 1));
        return;
      }

      if (key.downArrow) {
        setSelectedFileIndex(prev => (prev < fileSearchResults.length - 1 ? prev + 1 : 0));
        return;
      }

      if (key.return) {
        // Select the current file
        if (fileSearchResults.length > 0) {
          const selectedFile = fileSearchResults[selectedFileIndex];
          attachFile(selectedFile);
        }
        return;
      }

      if (key.backspace || key.delete) {
        if (fileSearchQuery.length > 0) {
          setFileSearchQuery(prev => prev.slice(0, -1));
        } else {
          // Exit file search if backspacing from empty query
          setIsFileSearchMode(false);
          setFileSearchQuery('');
          setFileSearchResults([]);
          setSelectedFileIndex(0);
        }
        return;
      }

      if (inputChar && !key.ctrl && !key.meta && inputChar.length === 1) {
        setFileSearchQuery(prev => prev + inputChar);
        return;
      }

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
    } else if (key.backspace || key.delete) {
      // Handle backspace
      if (historyIndex >= 0) {
        // If we're in history mode, exit it when user starts typing
        setHistoryIndex(-1);
        setOriginalInput('');
      }
      const newInput = input.slice(0, -1);
      setInput(newInput);

      // Check if we need to exit file search mode
      if (newInput.endsWith('@')) {
        setIsFileSearchMode(true);
        setFileSearchQuery('');
      } else if (isFileSearchMode && !newInput.includes('@')) {
        setIsFileSearchMode(false);
        setFileSearchQuery('');
        setFileSearchResults([]);
        setSelectedFileIndex(0);
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

      // Check for @ symbol to enter file search mode
      if (inputChar === '@' && !isFileSearchMode) {
        setIsFileSearchMode(true);
        setFileSearchQuery('');
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
        setMessages([]);
        setInput('');
        return;
      }

      if (trimmedInput === '/mode' || trimmedInput === '/thinking') {
        const newMode = currentMode === 'code' ? 'thinking' : 'code';
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

      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setAttachedFiles([]); // Clear attached files after sending
      setIsLoading(true);
      setError(null);

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
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
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

  // Memoize message rendering with responsive design
  const renderedMessages = useMemo(
    () =>
      messages.map((message, index) => (
        <Box key={index} marginBottom={isVerySmallScreen ? 0 : 1}>
          <FlashyText
            type={message.role === 'user' ? 'pulse' : 'wave'}
            speed={message.role === 'user' ? 400 : 200}
            colors={
              message.role === 'user'
                ? ['green', 'lime', 'cyan']
                : ['blue', 'cyan', 'magenta', 'yellow']
            }
          >
            {isVerySmallScreen
              ? message.role === 'user'
                ? '👤 '
                : '🤖 '
              : message.role === 'user'
                ? '👤 '
                : '🤖 '}
          </FlashyText>
          <Text>{message.content}</Text>
        </Box>
      )),
    [messages, themeColors, isVerySmallScreen]
  );

  // Memoize file search results to prevent unnecessary re-renders
  const renderedFileResults = useMemo(
    () =>
      fileSearchResults.slice(0, 5).map((file, index) => (
        <Text key={index} color={index === selectedFileIndex ? themeColors.userMessage : 'gray'}>
          {index === selectedFileIndex ? '▶ ' : '  '}
          {file.name} ({file.type})
        </Text>
      )),
    [fileSearchResults, selectedFileIndex, themeColors.userMessage]
  );

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box marginBottom={isVerySmallScreen ? 0 : 1}>
        <FlashyText type="rainbow" speed={300}>
          {headerText}
        </FlashyText>
      </Box>

      {/* Messages */}
      <Box flexDirection="column" flexGrow={1} marginBottom={isVerySmallScreen ? 0 : 1}>
        {renderedMessages}

        {isLoading && <InteractiveLoading />}

        {error && (
          <Box>
            <FlashyText type="flash" speed={150} colors={['red', 'orange', 'yellow']}>
              {`🚨 Error: ${error}`}
            </FlashyText>
          </Box>
        )}

        {/* File Search Interface */}
        {isFileSearchMode && (
          <Box flexDirection="column" marginBottom={1} paddingX={1}>
            <FlashyText type="neon" speed={150}>
              {`🔍 Search files: ${fileSearchQuery || '<type to search>'}${isSearchingFiles ? ' ⏳' : ''}`}
            </FlashyText>
            {isSearchingFiles ? (
              <FlashyText type="flash" speed={200} colors={['yellow', 'cyan']}>
                🔎 Searching...
              </FlashyText>
            ) : fileSearchResults.length > 0 ? (
              <Box flexDirection="column" marginTop={1}>
                {renderedFileResults}
                {fileSearchResults.length > 5 && (
                  <FlashyText type="pulse" speed={300} colors={['gray', 'white']}>
                    {`... and ${fileSearchResults.length - 5} more`}
                  </FlashyText>
                )}
              </Box>
            ) : fileSearchQuery ? (
              <FlashyText type="flash" speed={250} colors={['red', 'orange']}>
                {`No files found matching "${fileSearchQuery}"`}
              </FlashyText>
            ) : (
              <FlashyText type="wave" speed={180}>
                Start typing to search files...
              </FlashyText>
            )}
            <FlashyText type="gradient" speed={220}>
              ↑↓ navigate • Enter select • Esc cancel
            </FlashyText>
          </Box>
        )}

        {/* Attached Files Indicator */}
        {attachedFiles.length > 0 && !isFileSearchMode && (
          <Box marginBottom={1}>
            <FlashyText type="pulse" speed={350} colors={['cyan', 'green', 'yellow']}>
              {`📎 Attached: ${attachedFiles.map(f => f.path).join(', ')}`}
            </FlashyText>
          </Box>
        )}
      </Box>

      {/* Input */}
      <Box alignItems="flex-start">
        <FlashyText type="flash" speed={500} colors={['yellow', 'cyan']}>
          {isVerySmallScreen ? '$ ' : '> '}
        </FlashyText>
        <Text>
          {input || (
            <FlashyText type="wave" speed={250} colors={['gray', 'white']}>
              {isVerySmallScreen
                ? 'Msg...'
                : isSmallScreen
                  ? `Type message... (${currentMode})`
                  : `Type your message... (${currentMode}) (Ctrl+C to exit)`}
            </FlashyText>
          )}
        </Text>
      </Box>

      {/* Footer - conditionally rendered based on screen size and chat state */}
      {(messages.length > 0 || !isVerySmallScreen) && (
        <Box marginTop={1}>
          {isVerySmallScreen ? (
            <FlashyText type="static" speed={400} colors={['gray', 'white']}>
              Enter send • Ctrl+C exit
            </FlashyText>
          ) : (
            <>
              <FlashyText type="static" speed={400} colors={['gray', 'white']}>
                {isSmallScreen
                  ? 'Enter to send, Ctrl+C to exit'
                  : 'Type your message and press Enter to send, Ctrl+C to exit'}
              </FlashyText>
              {!isSmallScreen && (
                <FlashyText type="static" speed={300} colors={['cyan', 'magenta', 'yellow']}>
                  Commands: /verbose (toggle), /clear (clear), /compress (summarize), /themes
                  (switch), /mode (toggle) | Tab to toggle mode | ↑↓ for history
                </FlashyText>
              )}
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
