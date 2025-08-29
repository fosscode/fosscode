import { promises as fs } from 'fs';
import * as path from 'path';
import { MCPServerConfig } from './types.js';

export class MCPConfigManager {
  private configs: Map<string, MCPServerConfig> = new Map();
  private configDir: string;

  constructor() {
    // Use XDG config directory
    const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? '';
    this.configDir = path.join(homeDir, '.config', 'fosscode', 'mcp.d');
  }

  /**
   * Load all MCP server configurations from the config directory
   */
  async loadConfigs(): Promise<void> {
    try {
      // Ensure config directory exists
      await fs.mkdir(this.configDir, { recursive: true });

      // Read all .json files from the config directory
      const files = await fs.readdir(this.configDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      this.configs.clear();

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.configDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const config: MCPServerConfig = JSON.parse(content);

          // Validate required fields
          if (!config.name) {
            console.warn(`Skipping config file ${file}: missing 'name' field`);
            continue;
          }
          if (!config.command) {
            console.warn(`Skipping config file ${file}: missing 'command' field`);
            continue;
          }

          // Set defaults
          config.enabled = config.enabled ?? false;
          config.timeout = config.timeout ?? 30000;
          config.args = config.args ?? [];
          config.env = config.env ?? {};

          this.configs.set(config.name, config);
        } catch (error) {
          console.warn(`Failed to load config file ${file}:`, error);
        }
      }
    } catch (error) {
      console.warn('Failed to load MCP configurations:', error);
    }
  }

  /**
   * Get a specific server configuration
   */
  getConfig(serverName: string): MCPServerConfig | undefined {
    return this.configs.get(serverName);
  }

  /**
   * Get all server configurations
   */
  getAllConfigs(): MCPServerConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Add or update a server configuration
   */
  async saveConfig(config: MCPServerConfig): Promise<void> {
    // Ensure config directory exists
    await fs.mkdir(this.configDir, { recursive: true });

    const fileName = `${config.name}.json`;
    const filePath = path.join(this.configDir, fileName);

    await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');

    // Update in-memory cache
    this.configs.set(config.name, config);
  }

  /**
   * Remove a server configuration
   */
  async removeConfig(serverName: string): Promise<void> {
    const config = this.configs.get(serverName);
    if (!config) {
      return;
    }

    const fileName = `${serverName}.json`;
    const filePath = path.join(this.configDir, fileName);

    try {
      await fs.unlink(filePath);
      this.configs.delete(serverName);
    } catch (error) {
      console.warn(`Failed to remove config file for ${serverName}:`, error);
    }
  }

  /**
   * Get the config directory path
   */
  getConfigDir(): string {
    return this.configDir;
  }
}
