#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ChatCommand } from './commands/ChatCommand.js';
import { ConfigCommand } from './commands/ConfigCommand.js';
import { ProvidersCommand } from './commands/ProvidersCommand.js';
import { ModelsCommand } from './commands/ModelsCommand.js';
import { AuthCommand } from './commands/AuthCommand.js';
import { ThemesCommand } from './commands/ThemesCommand.js';
import { MCPCommand } from './commands/MCPCommand.js';
import { ThinkingCommand } from './commands/ThinkingCommand.js';
import { ConfigManager } from './config/ConfigManager.js';
import { ProviderManager } from './providers/ProviderManager.js';
import { initializeTools } from './tools/init.js';
import { PermissionManager } from './utils/PermissionManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));
const version = packageJson.version;

// Initialize managers for commands that need them
const configManager = new ConfigManager();
const providerManager = new ProviderManager(configManager);

const program = new Command();

program
  .name('fosscode')
  .description('Lightweight CLI for code agent interactions with LLMs')
  .version(version);

program
  .command('chat [message]')
  .description(
    'Start interactive chat session with LLM, or send a single message in non-interactive mode'
  )
  .option(
    '-p, --provider <provider>',
    'LLM provider (openai, grok, lmstudio, openrouter, sonicfree)'
  )
  .option('-m, --model <model>', 'Model to use')
  .option('-n, --non-interactive', 'Run in non-interactive mode (print response and exit)')
  .option('-v, --verbose', 'Enable verbose output (shows tool execution details)')
  .option('--messaging-platform <platform>', 'Use messaging platform (telegram, discord, slack)')
  .option(
    '--mcp <servers>',
    'Enable specific MCP servers (comma-separated, e.g., "playwright,context7")'
  )
  .option('--show-context', 'Display context usage information')
  .option('--context-format <format>', 'Context display format (percentage, tokens, both)', 'both')
  .option('--plan', 'Run in plan mode (agent suggests changes but does not execute them)')
  .action(async (message, options) => {
    try {
      // Initialize tools with verbose setting
      initializeTools(options.verbose);

      const permissionManager = new PermissionManager(options.plan ?? false);

      const chatCommand = new ChatCommand(options.verbose);
      await chatCommand.execute(message, options, permissionManager);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Manage configuration settings')
  .command('set <key> <value>')
  .description('Set configuration value')
  .action(async (key: string, value: string) => {
    const configCommand = new ConfigCommand();
    await configCommand.set(key, value);
  });

program
  .command('providers')
  .description('List available LLM providers')
  .action(() => {
    const providersCommand = new ProvidersCommand(providerManager);
    providersCommand.execute();
  });

program
  .command('models [provider]')
  .description('List available models for a provider (or all providers if none specified)')
  .option('-p, --provider <provider>', 'Filter by specific provider')
  .action(async (providerArg?: string, options?: { provider?: string }) => {
    const modelsCommand = new ModelsCommand(configManager, providerManager);
    await modelsCommand.execute(providerArg, options);
  });

program
  .command('auth')
  .description('Authentication commands')
  .command('login <provider>')
  .description('Login to a provider and store API credentials')
  .action(async (provider: string) => {
    const authCommand = new AuthCommand();
    await authCommand.login(provider);
  });

program
  .command('themes [theme]')
  .description('Manage themes (dark/light) or list available themes if no theme specified')
  .action(async (theme?: string) => {
    const themesCommand = new ThemesCommand();
    await themesCommand.execute(theme);
  });

program
  .command('mcp [subcommand] [args...]')
  .description('Manage MCP (Model Context Protocol) servers')
  .action(async (subcommand?: string, args?: string[]) => {
    const mcpCommand = new MCPCommand();
    await mcpCommand.execute(subcommand, ...(args || []));
  });

program
  .command('thinking [action]')
  .description('Control thinking blocks display from AI providers')
  .action(async (action?: string) => {
    const thinkingCommand = new ThinkingCommand(configManager);
    const args = action ? [action] : [];
    const result = await thinkingCommand.execute(args);
    console.log(result);
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

program.parse();
