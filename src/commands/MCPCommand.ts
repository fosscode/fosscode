import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from '../config/ConfigManager.js';
import { MCPServerConfig } from '../types/index.js';

export class MCPCommand {
  private configManager: ConfigManager;

  constructor(verbose: boolean = false) {
    this.configManager = new ConfigManager(verbose);
  }

  async list(): Promise<void> {
    try {
      const config = this.configManager.getConfig();
      const mcpConfig = config.providers.mcp;

      console.log(chalk.blue('MCP Server Configuration:'));
      console.log('');

      // Show legacy single server config
      if (mcpConfig.mcpServerCommand && mcpConfig.mcpServerArgs) {
        console.log(chalk.yellow('Legacy Single Server:'));
        console.log(`  Command: ${mcpConfig.mcpServerCommand}`);
        console.log(`  Args: ${mcpConfig.mcpServerArgs.join(' ')}`);
        console.log(`  URL: ${mcpConfig.mcpServerUrl ?? 'Not set'}`);
        console.log('');
      }

      // Show multiple servers
      if (mcpConfig.mcpServers && Object.keys(mcpConfig.mcpServers).length > 0) {
        console.log(chalk.yellow('Multiple Servers:'));
        for (const [name, server] of Object.entries(mcpConfig.mcpServers)) {
          const status =
            server.enabled !== false ? chalk.green('✓ Enabled') : chalk.red('✗ Disabled');
          console.log(`  ${chalk.bold(name)}: ${status}`);
          console.log(`    Command: ${server.mcpServerCommand ?? 'Not set'}`);
          console.log(
            `    Args: ${server.mcpServerArgs ? server.mcpServerArgs.join(' ') : 'Not set'}`
          );
          console.log(`    URL: ${server.mcpServerUrl ?? 'Not set'}`);
          console.log('');
        }
      } else {
        console.log(chalk.gray('No additional MCP servers configured.'));
      }

      // Show mcp.d directory status
      const xdgConfigDir = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
      const mcpDir = path.join(xdgConfigDir, 'fosscode', 'mcp.d');

      try {
        const stat = await fs.stat(mcpDir);
        if (stat.isDirectory()) {
          const files = await fs.readdir(mcpDir);
          const jsonFiles = files.filter(f => f.endsWith('.json'));
          console.log(
            chalk.yellow(
              `mcp.d Directory: ${chalk.green('Exists')} (${jsonFiles.length} config files)`
            )
          );
          if (jsonFiles.length > 0) {
            console.log('  Files:', jsonFiles.join(', '));
          }
        }
      } catch {
        console.log(chalk.yellow(`mcp.d Directory: ${chalk.gray('Does not exist')}`));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  async add(
    name: string,
    command: string,
    args: string[],
    options: { url?: string; enabled?: boolean } = {}
  ): Promise<void> {
    try {
      await this.configManager.loadConfig();
      const config = this.configManager.getConfig();

      if (!config.providers.mcp.mcpServers) {
        config.providers.mcp.mcpServers = {};
      }

      const serverConfig: MCPServerConfig = {
        name,
        mcpServerCommand: command,
        mcpServerArgs: args,
        enabled: options.enabled !== false,
        ...(options.url && { mcpServerUrl: options.url }),
      };

      config.providers.mcp.mcpServers[name] = serverConfig;
      await this.configManager.saveConfig();

      console.log(chalk.green(`✓ Added MCP server '${name}'`));
      console.log(`  Command: ${command}`);
      console.log(`  Args: ${args.join(' ')}`);
      if (options.url) {
        console.log(`  URL: ${options.url}`);
      }
      console.log(`  Status: ${serverConfig.enabled ? 'Enabled' : 'Disabled'}`);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  async remove(name: string): Promise<void> {
    try {
      await this.configManager.loadConfig();
      const config = this.configManager.getConfig();

      if (!config.providers.mcp.mcpServers?.[name]) {
        console.error(chalk.red(`Error: MCP server '${name}' not found`));
        process.exit(1);
      }

      delete config.providers.mcp.mcpServers[name];
      await this.configManager.saveConfig();

      console.log(chalk.green(`✓ Removed MCP server '${name}'`));
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  async enable(name: string): Promise<void> {
    try {
      await this.configManager.loadConfig();
      const config = this.configManager.getConfig();

      if (!config.providers.mcp.mcpServers?.[name]) {
        console.error(chalk.red(`Error: MCP server '${name}' not found`));
        process.exit(1);
      }

      config.providers.mcp.mcpServers[name].enabled = true;
      await this.configManager.saveConfig();

      console.log(chalk.green(`✓ Enabled MCP server '${name}'`));
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  async disable(name: string): Promise<void> {
    try {
      await this.configManager.loadConfig();
      const config = this.configManager.getConfig();

      if (!config.providers.mcp.mcpServers?.[name]) {
        console.error(chalk.red(`Error: MCP server '${name}' not found`));
        process.exit(1);
      }

      config.providers.mcp.mcpServers[name].enabled = false;
      await this.configManager.saveConfig();

      console.log(chalk.green(`✓ Disabled MCP server '${name}'`));
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  async createConfigFile(
    name: string,
    command: string,
    args: string[],
    options: { url?: string } = {}
  ): Promise<void> {
    try {
      const xdgConfigDir = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
      const mcpDir = path.join(xdgConfigDir, 'fosscode', 'mcp.d');
      const configFile = path.join(mcpDir, `${name}.json`);

      // Create mcp.d directory if it doesn't exist
      await fs.mkdir(mcpDir, { recursive: true });

      const serverConfig: MCPServerConfig = {
        name,
        mcpServerCommand: command,
        mcpServerArgs: args,
        enabled: true,
        ...(options.url && { mcpServerUrl: options.url }),
      };

      await fs.writeFile(configFile, JSON.stringify(serverConfig, null, 2));

      console.log(chalk.green(`✓ Created MCP config file: ${configFile}`));
      console.log(`  Run 'fosscode config reload' to load the new configuration.`);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
}
