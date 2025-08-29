import { MCPConnectionManager } from './MCPConnectionManager.js';
import { MCPToolManager } from './MCPToolManager.js';
import { MCPConfigManager } from './MCPConfigManager.js';
import { MCPServerConfig } from './types.js';

export class MCPManager {
  private connectionManager: MCPConnectionManager;
  private toolManager: MCPToolManager;
  private configManager: MCPConfigManager;
  private activeServers: Map<string, boolean> = new Map();

  constructor() {
    this.connectionManager = new MCPConnectionManager();
    this.toolManager = new MCPToolManager(this.connectionManager);
    this.configManager = new MCPConfigManager();
  }

  /**
   * Initialize MCP system by loading configurations
   */
  async initialize(): Promise<void> {
    await this.configManager.loadConfigs();
  }

  /**
   * Get list of available MCP server configurations
   */
  getAvailableServers(): MCPServerConfig[] {
    return this.configManager.getAllConfigs();
  }

  /**
   * Check if a server is currently enabled
   */
  isServerEnabled(serverName: string): boolean {
    return this.activeServers.get(serverName) ?? false;
  }

  /**
   * Enable an MCP server
   */
  async enableServer(serverName: string): Promise<void> {
    const config = this.configManager.getConfig(serverName);
    if (!config) {
      throw new Error(`MCP server '${serverName}' not found in configuration`);
    }

    if (this.activeServers.get(serverName)) {
      return; // Already enabled
    }

    try {
      await this.connectionManager.connectServer(config);
      await this.toolManager.discoverAndRegisterTools(config);
      this.activeServers.set(serverName, true);
    } catch (error) {
      throw new Error(
        `Failed to enable MCP server '${serverName}': ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Disable an MCP server
   */
  async disableServer(serverName: string): Promise<void> {
    if (!this.activeServers.get(serverName)) {
      return; // Already disabled
    }

    try {
      await this.toolManager.unregisterServerTools(serverName);
      await this.connectionManager.disconnectServer(serverName);
      this.activeServers.set(serverName, false);
    } catch (error) {
      throw new Error(
        `Failed to disable MCP server '${serverName}': ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Enable multiple servers at once
   */
  async enableServers(serverNames: string[]): Promise<void> {
    const errors: string[] = [];

    for (const serverName of serverNames) {
      try {
        await this.enableServer(serverName);
      } catch (error) {
        errors.push(`${serverName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Failed to enable some servers:\n${errors.join('\n')}`);
    }
  }

  /**
   * Disable all active servers
   */
  async disableAllServers(): Promise<void> {
    const activeServers = Array.from(this.activeServers.entries())
      .filter(([, enabled]) => enabled)
      .map(([name]) => name);

    for (const serverName of activeServers) {
      await this.disableServer(serverName);
    }
  }

  /**
   * Get status of all servers
   */
  getServerStatus(): Array<{ name: string; enabled: boolean; config: MCPServerConfig }> {
    return this.configManager.getAllConfigs().map(config => ({
      name: config.name,
      enabled: this.isServerEnabled(config.name),
      config,
    }));
  }

  /**
   * Cleanup all connections and resources
   */
  async cleanup(): Promise<void> {
    await this.disableAllServers();
    this.connectionManager.cleanup();
  }
}
