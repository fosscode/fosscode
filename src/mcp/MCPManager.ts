import { promises as fs } from 'fs';
import * as path from 'path';
import { MCPConnectionManager } from './MCPConnectionManager.js';
import { MCPToolManager } from './MCPToolManager.js';
import { MCPConfigManager } from './MCPConfigManager.js';
import {
  MCPServerConfig,
  MCPServerHealth,
  MCPServerTemplate,
  MCPToolDocumentation,
  MCPTool,
} from './types.js';
import { getTemplateById } from './templates/index.js';

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

  // ==================== Template Methods ====================

  /**
   * Create a server configuration from a template
   */
  async addServerFromTemplate(template: MCPServerTemplate, serverName?: string): Promise<void> {
    const name = serverName ?? template.id;

    const config: MCPServerConfig = {
      name,
      description: template.description,
      command: template.command,
      enabled: false,
      healthCheckInterval: 30000,
      autoRestart: true,
      maxRestartAttempts: 3,
    };

    // Only add optional fields if they have values
    if (template.args) {
      config.args = template.args;
    }
    if (template.env) {
      config.env = template.env;
    }
    if (template.permissions) {
      config.permissions = template.permissions;
    }

    await this.configManager.saveConfig(config);
  }

  // ==================== Documentation Methods ====================

  /**
   * Get all registered MCP tools across all servers
   */
  getAllRegisteredTools(): Array<{ serverName: string; toolName: string; mcpTool: MCPTool }> {
    return this.toolManager.getAllRegisteredTools();
  }

  /**
   * Get documentation for a specific tool
   */
  getToolDocumentation(toolName: string): MCPToolDocumentation | undefined {
    const allTools = this.toolManager.getAllRegisteredTools();

    // Find the tool - try exact match first, then partial match
    let toolInfo = allTools.find(
      (t) => t.mcpTool.name === toolName || t.toolName === toolName
    );

    if (!toolInfo) {
      // Try partial match
      toolInfo = allTools.find(
        (t) =>
          t.mcpTool.name.includes(toolName) ||
          t.toolName.includes(toolName) ||
          toolName.includes(t.mcpTool.name)
      );
    }

    if (!toolInfo) {
      return undefined;
    }

    const mcpTool = toolInfo.mcpTool;

    // Build documentation from tool schema
    const doc: MCPToolDocumentation = {
      toolName: mcpTool.name,
      serverName: toolInfo.serverName,
      description: mcpTool.description ?? 'No description available',
      parameters: [],
    };

    // Extract parameters from input schema
    if (mcpTool.inputSchema?.properties) {
      for (const [paramName, paramSchema] of Object.entries(mcpTool.inputSchema.properties)) {
        const schema = paramSchema as any;
        doc.parameters.push({
          name: paramName,
          type: schema.type ?? 'any',
          description: schema.description ?? `Parameter ${paramName}`,
          required: mcpTool.inputSchema.required?.includes(paramName) ?? false,
          defaultValue: schema.default,
        });
      }
    }

    return doc;
  }

  // ==================== Health Methods ====================

  /**
   * Get health status for all enabled servers
   */
  getHealthStatus(): MCPServerHealth[] {
    return this.connectionManager.getAllServerHealth();
  }

  /**
   * Get health status for a specific server
   */
  getServerHealth(serverName: string): MCPServerHealth | undefined {
    return this.connectionManager.getServerHealth(serverName);
  }

  /**
   * Force health check on all servers
   */
  async checkHealth(): Promise<MCPServerHealth[]> {
    return this.connectionManager.checkAllServersHealth();
  }

  // ==================== Discovery Methods ====================

  /**
   * Discover and suggest relevant MCP servers based on project context
   */
  async discoverRelevantServers(): Promise<
    Array<{ template: MCPServerTemplate; reason: string }>
  > {
    const suggestions: Array<{ template: MCPServerTemplate; reason: string }> = [];

    // Check for Git repository
    const hasGit = await this.checkFileExists('.git');
    if (hasGit) {
      const gitTemplate = getTemplateById('git');
      if (gitTemplate) {
        suggestions.push({
          template: gitTemplate,
          reason: 'Git repository detected',
        });
      }
    }

    // Check for package.json (Node.js project)
    const hasPackageJson = await this.checkFileExists('package.json');
    if (hasPackageJson) {
      const filesystemTemplate = getTemplateById('filesystem-local');
      if (filesystemTemplate) {
        suggestions.push({
          template: filesystemTemplate,
          reason: 'Node.js project detected - filesystem access useful for code exploration',
        });
      }
    }

    // Check for .github directory (GitHub integration)
    const hasGithub = await this.checkFileExists('.github');
    if (hasGithub) {
      const githubTemplate = getTemplateById('github');
      if (githubTemplate) {
        suggestions.push({
          template: githubTemplate,
          reason: 'GitHub workflows detected - GitHub API integration available',
        });
      }
    }

    // Check for database files
    const hasSqlite = await this.checkFilesExist(['*.db', '*.sqlite', '*.sqlite3']);
    if (hasSqlite) {
      const sqliteTemplate = getTemplateById('sqlite');
      if (sqliteTemplate) {
        suggestions.push({
          template: sqliteTemplate,
          reason: 'SQLite database files detected',
        });
      }
    }

    // Check for Docker (might need fetch for API testing)
    const hasDocker = await this.checkFileExists('docker-compose.yml');
    if (hasDocker) {
      const fetchTemplate = getTemplateById('fetch');
      if (fetchTemplate) {
        suggestions.push({
          template: fetchTemplate,
          reason: 'Docker Compose detected - web fetch useful for API testing',
        });
      }
    }

    // Always suggest memory for long-running sessions
    const memoryTemplate = getTemplateById('memory');
    if (memoryTemplate) {
      suggestions.push({
        template: memoryTemplate,
        reason: 'Knowledge graph memory for maintaining context across sessions',
      });
    }

    return suggestions;
  }

  /**
   * Check if a file or directory exists
   */
  private async checkFileExists(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if any of the given file patterns exist
   */
  private async checkFilesExist(patterns: string[]): Promise<boolean> {
    try {
      const files = await fs.readdir(process.cwd());
      for (const pattern of patterns) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        if (files.some((f) => regex.test(f))) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }
}
