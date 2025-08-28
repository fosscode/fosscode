import { useCallback } from 'react';
import { Message, ProviderType } from '../types/index.js';
import { ProviderManager } from '../providers/ProviderManager.js';
import { ConfigManager } from '../config/ConfigManager.js';
import { ChatLogger } from '../config/ChatLogger.js';

interface CommandHandlerOptions {
  provider: ProviderType;
  model: string;
  providerManager: ProviderManager;
  chatLogger: ChatLogger;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setInput: (value: string) => void;
  setIsVerbose: (value: boolean) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setCurrentMode: (mode: 'code' | 'thinking') => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  isVerbose: boolean;
  theme: 'dark' | 'light';
  currentMode: 'code' | 'thinking';
}

export function useCommandHandler({
  provider,
  model,
  providerManager,
  chatLogger,
  messages,
  setMessages,
  setInput,
  setIsVerbose,
  setTheme,
  setCurrentMode,
  setIsLoading,
  setError,
  isVerbose,
  theme,
  currentMode,
}: CommandHandlerOptions) {
  const handleCommand = useCallback(
    async (trimmedInput: string): Promise<boolean> => {
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
        return true;
      }

      if (trimmedInput === '/themes') {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        const configManager = new ConfigManager(false);
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
        return true;
      }

      if (trimmedInput === '/clear') {
        await chatLogger.logCommand('/clear', { messageCount: messages.length });
        setMessages([]);
        setInput('');
        return true;
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
        return true;
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
          return true;
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
        return true;
      }

      return false; // Not a command
    },
    [
      provider,
      model,
      providerManager,
      chatLogger,
      messages,
      setMessages,
      setInput,
      setIsVerbose,
      setTheme,
      setCurrentMode,
      setIsLoading,
      setError,
      isVerbose,
      theme,
      currentMode,
    ]
  );

  return { handleCommand };
}
