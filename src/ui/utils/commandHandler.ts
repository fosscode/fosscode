import { Message } from '../../types/index.js';
import { ProviderManager } from '../../providers/ProviderManager.js';
import { ProviderType } from '../../types/index.js';
import { ConfigManager } from '../../config/ConfigManager.js';
import { MCPManager } from '../../mcp/index.js';

export interface CommandResult {
  type: 'message' | 'clear' | 'none';
  message?: Message;
  shouldClearMessages?: boolean;
}

async function handleMCPCommand(command: string, timestamp: Date): Promise<CommandResult> {
  const mcpManager = new MCPManager();
  await mcpManager.initialize();

  const parts = command
    .toLowerCase()
    .split(' ')
    .filter(part => part.length > 0);
  const subcommand = parts[1]; // /mcp is parts[0]

  try {
    switch (subcommand) {
      case 'list': {
        const servers = mcpManager.getAvailableServers();
        if (servers.length === 0) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content:
                'No MCP server configurations found.\n\nAdd configuration files to `~/.config/fosscode/mcp.d/`',
              timestamp,
            },
          };
        }

        let content = 'Available MCP servers:\n\n';
        for (const server of servers) {
          const status = mcpManager.isServerEnabled(server.name) ? '● enabled' : '○ disabled';
          content += `${status} **${server.name}**\n`;
          content += `   ${server.description || 'No description'}\n`;
          content += `   Command: \`${server.command} ${server.args?.join(' ') || ''}\`\n\n`;
        }

        return {
          type: 'message',
          message: {
            role: 'assistant',
            content,
            timestamp,
          },
        };
      }

      case 'status': {
        const serverStatus = mcpManager.getServerStatus();
        if (serverStatus.length === 0) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content: 'No MCP server configurations found.',
              timestamp,
            },
          };
        }

        let content = 'MCP Server Status:\n\n';
        for (const { name, enabled, config } of serverStatus) {
          const status = enabled ? '● enabled' : '○ disabled';
          content += `${status} **${name}**\n`;
          content += `   ${config.description || 'No description'}\n\n`;
        }

        return {
          type: 'message',
          message: {
            role: 'assistant',
            content,
            timestamp,
          },
        };
      }

      case 'enable': {
        const serverNames = parts.slice(2); // Skip /mcp enable
        if (serverNames.length === 0) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content:
                'Please specify server names to enable.\n\nUsage: `/mcp enable <server1> [server2] ...`',
              timestamp,
            },
          };
        }

        await mcpManager.enableServers(serverNames);
        return {
          type: 'message',
          message: {
            role: 'assistant',
            content: `✅ Enabled MCP servers: ${serverNames.join(', ')}`,
            timestamp,
          },
        };
      }

      case 'disable': {
        const serverNames = parts.slice(2); // Skip /mcp disable
        if (serverNames.length === 0) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content:
                'Please specify server names to disable.\n\nUsage: `/mcp disable <server1> [server2] ...`',
              timestamp,
            },
          };
        }

        for (const serverName of serverNames) {
          await mcpManager.disableServer(serverName);
        }

        return {
          type: 'message',
          message: {
            role: 'assistant',
            content: `✅ Disabled MCP servers: ${serverNames.join(', ')}`,
            timestamp,
          },
        };
      }

      default: {
        return {
          type: 'message',
          message: {
            role: 'assistant',
            content:
              'MCP Server Management\n\n' +
              'Available commands:\n' +
              '• `/mcp` or `/mcp status` - Show server status\n' +
              '• `/mcp list` - List available servers\n' +
              '• `/mcp enable <server1> [server2] ...` - Enable servers\n' +
              '• `/mcp disable <server1> [server2] ...` - Disable servers',
            timestamp,
          },
        };
      }
    }
  } catch (error) {
    return {
      type: 'message',
      message: {
        role: 'assistant',
        content: `❌ MCP command failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp,
      },
    };
  }
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
  const normalizedCommand = command.toLowerCase().trim();

  switch (normalizedCommand) {
    case '/help':
    case '/commands':
      return {
        type: 'message',
        message: {
          role: 'assistant',
          content:
            `🤖 *Available Commands:*\n\n` +
            `• /verbose - Toggle verbose output mode\n` +
            `• /themes - Switch between dark/light theme\n` +
            `• /clear, /new, /nw, /cl - Clear conversation history\n` +
            `• /mode, /thinking - Toggle between code and thinking mode\n` +
            `• /compress - Compress conversation history to save space\n` +
            `• /god - Toggle GOD mode (bypass all approvals)\n` +
            `• /approval - Toggle approval mode for commands and edits\n` +
            `• /mcp - MCP server management (list, enable, disable)\n` +
            `• /help, /commands - Show this help message\n\n` +
            `💡 Type @ followed by a filename to attach files to your message\n` +
            `💡 Press Tab to toggle between code and thinking mode\n` +
            `💡 Just type your message normally to chat!`,
          timestamp,
        },
      };

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

    case '/god':
      const godConfigManager = new ConfigManager();
      const currentConfig = godConfigManager.getConfig();
      const currentGodMode = currentConfig.approvalMode?.godMode ?? false;
      const newGodMode = !currentGodMode;
      godConfigManager.setConfig('approvalMode.godMode', newGodMode);
      return {
        type: 'message',
        message: {
          role: 'assistant',
          content: `GOD mode ${newGodMode ? 'enabled' : 'disabled'}. ${newGodMode ? 'All commands and edits will be allowed without approval.' : 'Approval mode is now active.'}`,
          timestamp,
        },
      };

    case '/approval':
      const approvalConfigManager = new ConfigManager();
      const approvalCurrentConfig = approvalConfigManager.getConfig();
      const currentApprovalMode = approvalCurrentConfig.approvalMode?.enabled ?? false;
      const newApprovalMode = !currentApprovalMode;
      approvalConfigManager.setConfig('approvalMode.enabled', newApprovalMode);
      return {
        type: 'message',
        message: {
          role: 'assistant',
          content: `Approval mode ${newApprovalMode ? 'enabled' : 'disabled'}. ${newApprovalMode ? 'Commands and edits will require approval.' : 'All actions will be allowed without approval.'}`,
          timestamp,
        },
      };

    case '/clear':
    case '/new':
    case '/nw':
    case '/cl':
      return {
        type: 'clear',
        shouldClearMessages: true,
        message: {
          role: 'assistant',
          content: '🧹 Conversation history cleared! Starting fresh.',
          timestamp,
        },
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
      // Handle MCP commands
      if (normalizedCommand.startsWith('/mcp')) {
        return await handleMCPCommand(command, timestamp);
      }

      return {
        type: 'none',
      };
  }
}

export function toggleMode(currentMode: 'code' | 'thinking'): 'code' | 'thinking' {
  return currentMode === 'code' ? 'thinking' : 'code';
}
