import { Message } from '../../types/index.js';
import { ProviderManager } from '../../providers/ProviderManager.js';
import { ProviderType } from '../../types/index.js';
import { ConfigManager } from '../../config/ConfigManager.js';
import { MCPManager } from '../../mcp/index.js';
import { ReviewCommand, ReviewMode, ReviewOptions } from '../../commands/ReviewCommand.js';
import { getSkillManager } from '../../utils/SkillManager.js';
import { SkillFile } from '../../types/skills.js';
import { backgroundTaskManager } from '../../utils/BackgroundTaskManager.js';
import { handleRewindCommand } from '../../commands/RewindCommand.js';
import { SessionCommand } from '../../commands/SessionCommand.js';

export interface CommandResult {
  type: 'message' | 'clear' | 'none';
  message?: Message;
  shouldClearMessages?: boolean;
}

async function handleReviewCommand(
  command: string,
  timestamp: Date,
  currentState: {
    provider: ProviderType;
    model: string;
    isVerbose: boolean;
  }
): Promise<CommandResult> {
  const parts = command.split(/\s+/).filter(part => part.length > 0);

  // Parse options from command
  const options: ReviewOptions = {
    provider: currentState.provider,
    model: currentState.model,
    verbose: currentState.isVerbose,
  };

  // Parse flags
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].toLowerCase();
    switch (part) {
      case '--security':
      case '-s':
        options.mode = 'security';
        break;
      case '--performance':
      case '-p':
        options.mode = 'performance';
        break;
      case '--style':
        options.mode = 'style';
        break;
      case '--staged':
        options.staged = true;
        break;
      case '--commit':
        if (i + 1 < parts.length) {
          options.commit = parts[++i];
        }
        break;
      case '--branch':
      case '-b':
        if (i + 1 < parts.length) {
          options.baseBranch = parts[++i];
        }
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      default:
        // Check if it's a mode without flag prefix
        if (['security', 'performance', 'style', 'general'].includes(part)) {
          options.mode = part as ReviewMode;
        }
        break;
    }
  }

  try {
    const reviewCommand = new ReviewCommand();
    const result = await reviewCommand.execute(options);
    const formattedOutput = reviewCommand.formatFindings(result);

    return {
      type: 'message',
      message: {
        role: 'assistant',
        content: formattedOutput,
        timestamp,
      },
    };
  } catch (error) {
    return {
      type: 'message',
      message: {
        role: 'assistant',
        content: `Review failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp,
      },
    };
  }
}

async function handleSkillsCommand(command: string, timestamp: Date): Promise<CommandResult> {
  const skillManager = getSkillManager();
  await skillManager.initialize();

  const parts = command.split(/\s+/).filter(part => part.length > 0);
  const subcommand = parts[1]?.toLowerCase(); // /skills is parts[0]

  try {
    switch (subcommand) {
      case 'list':
      case undefined: {
        const skills = skillManager.listSkills();
        if (skills.length === 0) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content:
                'No skills available.\n\nUse `/skills create <name>` to create a new skill.',
              timestamp,
            },
          };
        }

        let content = '**Available Skills:**\n\n';
        const builtinSkills = skills.filter(s => s.source === 'builtin');
        const userSkills = skills.filter(s => s.source === 'user');

        if (builtinSkills.length > 0) {
          content += '**Built-in Skills:**\n';
          for (const skill of builtinSkills) {
            const status = skill.enabled !== false ? '●' : '○';
            content += `${status} \`$${skill.name}\` - ${skill.description}\n`;
          }
          content += '\n';
        }

        if (userSkills.length > 0) {
          content += '**User Skills:**\n';
          for (const skill of userSkills) {
            const status = skill.enabled !== false ? '●' : '○';
            content += `${status} \`$${skill.name}\` - ${skill.description}\n`;
          }
          content += '\n';
        }

        content += '\n**Usage:**\n';
        content += '* Type `$skill-name` in your message to invoke a skill\n';
        content += '* Skills provide specialized instructions for common tasks\n';
        content += '* Use `/skills info <name>` to see skill details';

        return {
          type: 'message',
          message: {
            role: 'assistant',
            content,
            timestamp,
          },
        };
      }

      case 'info': {
        const skillName = parts[2];
        if (!skillName) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content: 'Please specify a skill name.\n\nUsage: `/skills info <skill-name>`',
              timestamp,
            },
          };
        }

        const skill = skillManager.getSkill(skillName);
        if (!skill) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content: `Skill "${skillName}" not found.\n\nUse \`/skills list\` to see available skills.`,
              timestamp,
            },
          };
        }

        let content = `**Skill: $${skill.name}**\n\n`;
        content += `**Description:** ${skill.description}\n`;
        content += `**Version:** ${skill.version}\n`;
        content += `**Source:** ${skill.source}\n`;
        content += `**Status:** ${skill.enabled !== false ? 'Enabled' : 'Disabled'}\n`;

        if (skill.author) {
          content += `**Author:** ${skill.author}\n`;
        }

        if (skill.tags && skill.tags.length > 0) {
          content += `**Tags:** ${skill.tags.join(', ')}\n`;
        }

        if (skill.triggers) {
          content += '\n**Auto-Triggers:**\n';
          if (skill.triggers.keywords && skill.triggers.keywords.length > 0) {
            content += `* Keywords: ${skill.triggers.keywords.join(', ')}\n`;
          }
          if (skill.triggers.patterns && skill.triggers.patterns.length > 0) {
            content += `* Patterns: ${skill.triggers.patterns.join(', ')}\n`;
          }
        }

        content += '\n**Instructions Preview:**\n';
        const instructionPreview = skill.instructions.slice(0, 500);
        content += `\`\`\`\n${instructionPreview}${skill.instructions.length > 500 ? '...' : ''}\n\`\`\``;

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
        const skillName = parts[2];
        if (!skillName) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content: 'Please specify a skill name.\n\nUsage: `/skills enable <skill-name>`',
              timestamp,
            },
          };
        }

        const success = await skillManager.enableSkill(skillName);
        if (!success) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content: `Skill "${skillName}" not found.`,
              timestamp,
            },
          };
        }

        return {
          type: 'message',
          message: {
            role: 'assistant',
            content: `Skill "$${skillName}" enabled.`,
            timestamp,
          },
        };
      }

      case 'disable': {
        const skillName = parts[2];
        if (!skillName) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content: 'Please specify a skill name.\n\nUsage: `/skills disable <skill-name>`',
              timestamp,
            },
          };
        }

        const success = await skillManager.disableSkill(skillName);
        if (!success) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content: `Skill "${skillName}" not found.`,
              timestamp,
            },
          };
        }

        return {
          type: 'message',
          message: {
            role: 'assistant',
            content: `Skill "$${skillName}" disabled.`,
            timestamp,
          },
        };
      }

      case 'create': {
        const skillName = parts[2];
        if (!skillName) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content:
                'Please specify a skill name.\n\nUsage: `/skills create <skill-name>`\n\n' +
                'This will create a template skill file in:\n' +
                `\`${skillManager.getUserSkillsDir()}/\``,
              timestamp,
            },
          };
        }

        // Check if skill already exists
        if (skillManager.getSkill(skillName)) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content: `Skill "${skillName}" already exists.`,
              timestamp,
            },
          };
        }

        // Create template skill
        const templateSkill: SkillFile = {
          name: skillName,
          description: `Custom skill: ${skillName}`,
          version: '1.0.0',
          instructions: `# ${skillName} Skill Instructions\n\nAdd your instructions here.\n\nThese instructions will be injected into the system prompt when this skill is invoked.`,
          triggers: {
            keywords: [skillName],
            confidenceThreshold: 0.6,
          },
          tags: ['custom'],
          enabled: true,
        };

        const skill = await skillManager.createSkill(templateSkill);

        return {
          type: 'message',
          message: {
            role: 'assistant',
            content:
              `Skill "$${skillName}" created!\n\n` +
              `Edit the skill file at:\n\`${skill.filePath}\`\n\n` +
              `Use \`$${skillName}\` in your messages to invoke this skill.`,
            timestamp,
          },
        };
      }

      case 'delete': {
        const skillName = parts[2];
        if (!skillName) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content: 'Please specify a skill name.\n\nUsage: `/skills delete <skill-name>`',
              timestamp,
            },
          };
        }

        const skill = skillManager.getSkill(skillName);
        if (!skill) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content: `Skill "${skillName}" not found.`,
              timestamp,
            },
          };
        }

        if (skill.source === 'builtin') {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content: `Cannot delete built-in skill "${skillName}". Use \`/skills disable ${skillName}\` instead.`,
              timestamp,
            },
          };
        }

        await skillManager.deleteSkill(skillName);

        return {
          type: 'message',
          message: {
            role: 'assistant',
            content: `Skill "$${skillName}" deleted.`,
            timestamp,
          },
        };
      }

      case 'export': {
        const skillNames = parts.slice(2);
        const exportData = await skillManager.exportSkills(
          skillNames.length > 0 ? skillNames : undefined
        );

        return {
          type: 'message',
          message: {
            role: 'assistant',
            content:
              `**Exported ${exportData.skills.length} skill(s):**\n\n` +
              '```json\n' +
              JSON.stringify(exportData, null, 2) +
              '\n```\n\n' +
              'Copy the JSON above to share or backup your skills.',
            timestamp,
          },
        };
      }

      case 'import': {
        // For import, we need the JSON to be provided
        // This is a simplified version - full import would need multi-line input
        return {
          type: 'message',
          message: {
            role: 'assistant',
            content:
              '**Import Skills:**\n\n' +
              'To import skills, save the exported JSON to a `.json` file in:\n' +
              `\`${skillManager.getUserSkillsDir()}/\`\n\n` +
              'The skill will be loaded automatically on next startup.\n\n' +
              'Or use `/skills reload` to load new skills immediately.',
            timestamp,
          },
        };
      }

      case 'reload': {
        await skillManager.reload();
        const skills = skillManager.listSkills();

        return {
          type: 'message',
          message: {
            role: 'assistant',
            content: `Reloaded ${skills.length} skill(s) from disk.`,
            timestamp,
          },
        };
      }

      case 'dir':
      case 'path': {
        return {
          type: 'message',
          message: {
            role: 'assistant',
            content:
              `**Skills Directory:**\n\n` +
              `User skills are stored in:\n\`${skillManager.getUserSkillsDir()}/\`\n\n` +
              'Create `.yaml` or `.json` files in this directory to add custom skills.',
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
              '**Skills Management**\n\n' +
              'Available commands:\n' +
              '* `/skills` or `/skills list` - List all skills\n' +
              '* `/skills info <name>` - Show skill details\n' +
              '* `/skills enable <name>` - Enable a skill\n' +
              '* `/skills disable <name>` - Disable a skill\n' +
              '* `/skills create <name>` - Create a new skill\n' +
              '* `/skills delete <name>` - Delete a user skill\n' +
              '* `/skills export [names...]` - Export skills as JSON\n' +
              '* `/skills import` - Import skills from file\n' +
              '* `/skills reload` - Reload skills from disk\n' +
              '* `/skills dir` - Show skills directory path\n\n' +
              '**Usage:**\n' +
              'Type `$skill-name` in your message to invoke a skill.\n' +
              'Example: `$commit please commit the changes`',
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
        content: `Skills command failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp,
      },
    };
  }
}

async function handleTasksCommand(command: string, timestamp: Date): Promise<CommandResult> {
  const parts = command
    .toLowerCase()
    .split(' ')
    .filter(part => part.length > 0);
  const subcommand = parts[1]; // /tasks is parts[0]

  try {
    switch (subcommand) {
      case 'list':
      case undefined: {
        const content = backgroundTaskManager.getTaskListDisplay();
        return {
          type: 'message',
          message: {
            role: 'assistant',
            content,
            timestamp,
          },
        };
      }

      case 'cancel': {
        const taskId = parts[2];
        if (!taskId) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content:
                'Please specify a task ID to cancel.\n\nUsage: `/tasks cancel <task-id>`\n\nUse `/tasks` to see task IDs.',
              timestamp,
            },
          };
        }

        const cancelled = backgroundTaskManager.cancelTask(taskId);
        return {
          type: 'message',
          message: {
            role: 'assistant',
            content: cancelled
              ? `✅ Task ${taskId} cancelled.`
              : `❌ Task ${taskId} not found or cannot be cancelled.`,
            timestamp,
          },
        };
      }

      case 'output': {
        const taskId = parts[2];
        if (!taskId) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content:
                'Please specify a task ID to view output.\n\nUsage: `/tasks output <task-id>`',
              timestamp,
            },
          };
        }

        const task = backgroundTaskManager.getTask(taskId);
        if (!task) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content: `❌ Task ${taskId} not found.`,
              timestamp,
            },
          };
        }

        const output = backgroundTaskManager.getTaskOutput(taskId);
        if (output.length === 0) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content: `No output available for task: ${task.name}`,
              timestamp,
            },
          };
        }

        let content = `**Output for task: ${task.name}**\n\n`;
        for (const item of output) {
          const prefix = item.type === 'stderr' ? '[ERR] ' : item.type === 'progress' ? '[...] ' : '';
          content += `${prefix}${item.content}\n`;
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

      case 'clear': {
        const clearedCount = backgroundTaskManager.clearQueue();
        return {
          type: 'message',
          message: {
            role: 'assistant',
            content:
              clearedCount > 0
                ? `✅ Cleared ${clearedCount} queued task(s).`
                : 'No queued tasks to clear.',
            timestamp,
          },
        };
      }

      case 'history': {
        const subAction = parts[2];
        if (subAction === 'clear') {
          const clearedCount = backgroundTaskManager.clearHistory();
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content:
                clearedCount > 0
                  ? `✅ Cleared ${clearedCount} completed task(s) from history.`
                  : 'No completed tasks to clear.',
              timestamp,
            },
          };
        }

        // Show completed and failed tasks
        const completed = backgroundTaskManager.getCompletedTasks();
        const failed = backgroundTaskManager.getFailedTasks();

        if (completed.length === 0 && failed.length === 0) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content: 'No task history available.',
              timestamp,
            },
          };
        }

        let content = '**Task History:**\n\n';

        if (completed.length > 0) {
          content += '**Completed:**\n';
          content += completed.map(t => backgroundTaskManager.formatTaskDisplay(t)).join('\n');
          content += '\n\n';
        }

        if (failed.length > 0) {
          content += '**Failed:**\n';
          content += failed.map(t => backgroundTaskManager.formatTaskDisplay(t)).join('\n');
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

      case 'stats': {
        const stats = backgroundTaskManager.getStats();
        const content =
          `**Task Queue Statistics:**\n\n` +
          `• Queued: ${stats.totalQueued}\n` +
          `• Running: ${stats.totalRunning}\n` +
          `• Completed: ${stats.totalCompleted}\n` +
          `• Failed: ${stats.totalFailed}\n` +
          `• Processing: ${stats.isProcessing ? 'Yes' : 'No'}`;

        return {
          type: 'message',
          message: {
            role: 'assistant',
            content,
            timestamp,
          },
        };
      }

      default:
        return {
          type: 'message',
          message: {
            role: 'assistant',
            content:
              '**Background Tasks Management**\n\n' +
              'Available commands:\n' +
              '• `/tasks` or `/tasks list` - Show all tasks\n' +
              '• `/tasks output <task-id>` - View task output\n' +
              '• `/tasks cancel <task-id>` - Cancel a task\n' +
              '• `/tasks clear` - Clear queued tasks\n' +
              '• `/tasks history` - View completed/failed tasks\n' +
              '• `/tasks history clear` - Clear task history\n' +
              '• `/tasks stats` - View queue statistics',
            timestamp,
          },
        };
    }
  } catch (error) {
    return {
      type: 'message',
      message: {
        role: 'assistant',
        content: `❌ Tasks command failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp,
      },
    };
  }
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
    setModel?: (model: string) => void;
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
            `• /models - List available models for current provider\n` +
            `• /model <name> - Switch to a specific model\n` +
            `• /clear, /new, /nw, /cl - Clear conversation history\n` +
            `• /mode, /thinking - Toggle between code and thinking mode\n` +
            `• /compress - Compress conversation history to save space\n` +
            `• /god - Toggle GOD mode (bypass all approvals)\n` +
            `• /approval - Toggle approval mode for commands and edits\n` +
            `• /mcp - MCP server management (list, enable, disable)\n` +
            `• /review - Code review (--security, --performance, --style, --staged)\n` +
            `• /tasks - Background task management (list, cancel, output)\n` +
            `• /rewind - Checkpoint management and file rewind (undo, diff)\n` +
            `• /skills - Skill management (list, create, enable, disable)\n` +
            `• /session - Session management (save, resume, export, templates)\n` +
            `• /help, /commands - Show this help message\n\n` +
            `💡 Type @ followed by a filename to attach files to your message\n` +
            `💡 Type $skill-name to invoke a skill (e.g., $commit, $debug)\n` +
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

    case '/models':
      try {
        const models = await currentState.providerManager.listModels(currentState.provider);
        if (models.length === 0) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content: `No models available for ${currentState.provider} provider.`,
              timestamp,
            },
          };
        }

        let content = `📋 Available models for ${currentState.provider}:\n\n`;
        models.forEach(modelName => {
          const isCurrent = modelName === currentState.model;
          content += `${isCurrent ? '●' : '○'} ${modelName}${isCurrent ? ' (current)' : ''}\n`;
        });

        return {
          type: 'message',
          message: {
            role: 'assistant',
            content,
            timestamp,
          },
        };
      } catch (err) {
        return {
          type: 'message',
          message: {
            role: 'assistant',
            content: `Failed to list models: ${err instanceof Error ? err.message : 'Unknown error'}`,
            timestamp,
          },
        };
      }

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

    case '/model':
      return {
        type: 'message',
        message: {
          role: 'assistant',
          content:
            'Please specify a model name.\n\nUsage: `/model <model-name>`\n\nUse `/models` to see available models.',
          timestamp,
        },
      };

    default:
      // Handle /model command with arguments
      if (normalizedCommand.startsWith('/model ')) {
        const modelName = command.slice(7).trim(); // Remove '/model ' prefix
        if (!modelName) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content:
                'Please specify a model name.\n\nUsage: `/model <model-name>`\n\nUse `/models` to see available models.',
              timestamp,
            },
          };
        }

        try {
          // Validate that the model exists for the current provider
          const availableModels = await currentState.providerManager.listModels(
            currentState.provider
          );
          if (!availableModels.includes(modelName)) {
            return {
              type: 'message',
              message: {
                role: 'assistant',
                content: `Model "${modelName}" is not available for ${currentState.provider} provider.\n\nUse \`/models\` to see available models.`,
                timestamp,
              },
            };
          }

          // Switch to the new model
          if (currentState.setModel) {
            currentState.setModel(modelName);

            // Update config
            const configManager = new ConfigManager();
            configManager.setConfig('lastSelectedModel', modelName);
            configManager.setConfig('lastSelectedProvider', currentState.provider);
          }

          return {
            type: 'message',
            message: {
              role: 'assistant',
              content: `🔄 Switched to model: ${modelName}`,
              timestamp,
            },
          };
        } catch (err) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content: `Failed to switch model: ${err instanceof Error ? err.message : 'Unknown error'}`,
              timestamp,
            },
          };
        }
      }

      // Handle review commands
      if (normalizedCommand.startsWith('/review')) {
        return await handleReviewCommand(command, timestamp, {
          provider: currentState.provider,
          model: currentState.model,
          isVerbose: currentState.isVerbose,
        });
      }

      // Handle MCP commands
      if (normalizedCommand.startsWith('/mcp')) {
        return await handleMCPCommand(command, timestamp);
      }

      // Handle tasks commands
      if (normalizedCommand.startsWith('/tasks')) {
        return await handleTasksCommand(command, timestamp);
      }

      // Handle rewind commands
      if (normalizedCommand.startsWith('/rewind')) {
        try {
          const result = await handleRewindCommand(command);
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content: result,
              timestamp,
            },
          };
        } catch (error) {
          return {
            type: 'message',
            message: {
              role: 'assistant',
              content: `Rewind command failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              timestamp,
            },
          };
        }
      }

      // Handle skills commands
      if (normalizedCommand.startsWith('/skills')) {
        return await handleSkillsCommand(command, timestamp);
      }

      // Handle session commands
      if (normalizedCommand.startsWith('/session')) {
        return await handleSessionCommand(command, timestamp, currentState.messages, {
          provider: currentState.provider,
          model: currentState.model,
        });
      }

      return {
        type: 'none',
      };
  }
}

async function handleSessionCommand(
  command: string,
  timestamp: Date,
  messages: Message[],
  options: { provider: ProviderType; model: string }
): Promise<CommandResult> {
  const parts = command.split(/\s+/).filter(part => part.length > 0);
  const subcommand = parts[1] ?? 'help';
  const args = parts.slice(2);

  // Parse options from command
  const sessionOptions: Record<string, string | boolean | number | undefined> = {
    provider: options.provider,
    model: options.model,
  };

  // Parse flags
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--template' && args[i + 1]) {
      sessionOptions.template = args[i + 1];
      args.splice(i, 2);
      i--;
    } else if (arg === '--format' && args[i + 1]) {
      sessionOptions.format = args[i + 1];
      args.splice(i, 2);
      i--;
    } else if (arg === '--output' && args[i + 1]) {
      sessionOptions.output = args[i + 1];
      args.splice(i, 2);
      i--;
    } else if (arg === '--port' && args[i + 1]) {
      sessionOptions.port = parseInt(args[i + 1], 10);
      args.splice(i, 2);
      i--;
    } else if (arg === '--name' && args[i + 1]) {
      sessionOptions.name = args[i + 1];
      args.splice(i, 2);
      i--;
    } else if (arg === '--description' && args[i + 1]) {
      sessionOptions.description = args[i + 1];
      args.splice(i, 2);
      i--;
    }
  }

  try {
    const sessionCommand = new SessionCommand();
    const result = await sessionCommand.execute(subcommand, args, sessionOptions as any, messages);

    // Handle session resume - need to restore messages
    if ((subcommand === 'resume' || subcommand === 'load') && result.success && result.data) {
      return {
        type: 'clear',
        shouldClearMessages: true,
        message: {
          role: 'assistant',
          content: result.message,
          timestamp,
        },
      };
    }

    return {
      type: 'message',
      message: {
        role: 'assistant',
        content: result.message,
        timestamp,
      },
    };
  } catch (error) {
    return {
      type: 'message',
      message: {
        role: 'assistant',
        content: `Session command failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp,
      },
    };
  }
}

export function toggleMode(currentMode: 'code' | 'thinking'): 'code' | 'thinking' {
  return currentMode === 'code' ? 'thinking' : 'code';
}
