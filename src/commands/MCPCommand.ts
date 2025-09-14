import pc from 'picocolors';
import { MCPManager } from '../mcp/index.js';

export class MCPCommand {
  private mcpManager: MCPManager;

  constructor() {
    this.mcpManager = new MCPManager();
  }

  async initialize(): Promise<void> {
    await this.mcpManager.initialize();
  }

  async list(): Promise<void> {
    const servers = this.mcpManager.getAvailableServers();

    if (servers.length === 0) {
      console.log(pc.yellow('No MCP server configurations found.'));
      console.log(pc.gray('Add configuration files to ~/.config/fosscode/mcp.d/'));
      return;
    }

    console.log(pc.blue('Available MCP servers:'));
    console.log('');

    for (const server of servers) {
      const status = this.mcpManager.isServerEnabled(server.name)
        ? pc.green('● enabled')
        : pc.gray('○ disabled');

      console.log(`${pc.bold(server.name)} ${status}`);
      console.log(`  ${server.description ?? 'No description'}`);
      console.log(`  Command: ${server.command} ${server.args?.join(' ') ?? ''}`);
      console.log('');
    }
  }

  async status(): Promise<void> {
    const serverStatus = this.mcpManager.getServerStatus();

    if (serverStatus.length === 0) {
      console.log(pc.yellow('No MCP server configurations found.'));
      return;
    }

    console.log(pc.blue('MCP Server Status:'));
    console.log('');

    for (const { name, enabled, config } of serverStatus) {
      const status = enabled ? pc.green('● enabled') : pc.gray('○ disabled');
      console.log(`${pc.bold(name)} ${status}`);
      console.log(`  ${config.description ?? 'No description'}`);
    }
  }

  async enable(serverNames: string[]): Promise<void> {
    try {
      await this.mcpManager.enableServers(serverNames);
      console.log(pc.green(`✓ Enabled MCP servers: ${serverNames.join(', ')}`));
    } catch (error) {
      console.error(pc.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  async disable(serverNames: string[]): Promise<void> {
    const errors: string[] = [];

    for (const serverName of serverNames) {
      try {
        await this.mcpManager.disableServer(serverName);
      } catch (error) {
        errors.push(`${serverName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (errors.length > 0) {
      console.error(pc.red('Errors:'));
      for (const error of errors) {
        console.error(pc.red(`  ${error}`));
      }
      process.exit(1);
    } else {
      console.log(pc.green(`✓ Disabled MCP servers: ${serverNames.join(', ')}`));
    }
  }

  async execute(subcommand?: string, ...args: string[]): Promise<void> {
    await this.initialize();

    switch (subcommand) {
      case 'list':
      case undefined:
        await this.list();
        break;

      case 'status':
        await this.status();
        break;

      case 'enable':
        if (args.length === 0) {
          console.error(pc.red('Error: Please specify server names to enable'));
          console.log(pc.gray('Usage: fosscode mcp enable <server1> [server2] ...'));
          process.exit(1);
        }
        await this.enable(args);
        break;

      case 'disable':
        if (args.length === 0) {
          console.error(pc.red('Error: Please specify server names to disable'));
          console.log(pc.gray('Usage: fosscode mcp disable <server1> [server2] ...'));
          process.exit(1);
        }
        await this.disable(args);
        break;

      default:
        console.error(pc.red(`Unknown subcommand: ${subcommand}`));
        console.log(pc.gray('Available subcommands: list, status, enable, disable'));
        process.exit(1);
    }
  }
}
