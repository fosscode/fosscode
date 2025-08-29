import { Message } from '../../types/index.js';
import { ProviderManager } from '../../providers/ProviderManager.js';
import { ProviderType } from '../../types/index.js';
import { ConfigManager } from '../../config/ConfigManager.js';

export interface CommandResult {
  type: 'message' | 'clear' | 'none';
  message?: Message;
  shouldClearMessages?: boolean;
}

export async function handleCommand(
  command: string,
  currentState: {
    isVerbose: boolean;
    theme: 'dark' | 'light';
    currentMode: 'code' | 'thinking';
    messages: Message[];
    provider: ProviderType;
    model: string;
    providerManager: ProviderManager;
  }
): Promise<CommandResult> {
  const timestamp = new Date();

  switch (command) {
    case '/verbose':
      return {
        type: 'message',
        message: {
          role: 'assistant',
          content: `Verbose mode ${!currentState.isVerbose ? 'enabled' : 'disabled'}`,
          timestamp,
        },
      };

    case '/themes':
      const newTheme = currentState.theme === 'dark' ? 'light' : 'dark';
      const configManager = new ConfigManager();
      configManager.setConfig('theme', newTheme);
      return {
        type: 'message',
        message: {
          role: 'assistant',
          content: `Theme switched to: ${newTheme}`,
          timestamp,
        },
      };

    case '/clear':
      return {
        type: 'clear',
        shouldClearMessages: true,
      };

    case '/mode':
    case '/thinking':
      const newMode = currentState.currentMode === 'code' ? 'thinking' : 'code';
      return {
        type: 'message',
        message: {
          role: 'assistant',
          content: `Switched to ${newMode} mode`,
          timestamp,
        },
      };

    case '/compress':
      if (currentState.messages.length === 0) {
        return {
          type: 'message',
          message: {
            role: 'assistant',
            content: 'No conversation history to compress.',
            timestamp,
          },
        };
      }

      try {
        // Create a summary prompt
        const conversationText = currentState.messages
          .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
          .join('\n\n');

        const summaryPrompt = `Please provide a concise summary of the following conversation. Focus on the key points, decisions made, and current context. Keep it brief but comprehensive enough to maintain continuity:

${conversationText}

Summary:`;

        const summaryMessage: Message = {
          role: 'user',
          content: summaryPrompt,
          timestamp,
        };

        const response = await currentState.providerManager.sendMessage(
          currentState.provider,
          [summaryMessage],
          currentState.model,
          false // Don't use verbose for compression
        );

        // Return compressed conversation
        return {
          type: 'clear',
          shouldClearMessages: true,
          message: {
            role: 'assistant',
            content: `🗜️ Conversation compressed. Previous context summarized:\n\n${response.content}`,
            timestamp,
          },
        };
      } catch (err) {
        return {
          type: 'message',
          message: {
            role: 'assistant',
            content: `Failed to compress conversation: ${err instanceof Error ? err.message : 'Unknown error'}`,
            timestamp,
          },
        };
      }

    default:
      return {
        type: 'none',
      };
  }
}

export function toggleMode(currentMode: 'code' | 'thinking'): 'code' | 'thinking' {
  return currentMode === 'code' ? 'thinking' : 'code';
}
