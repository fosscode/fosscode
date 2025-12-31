import { promises as fs } from 'fs';
import * as path from 'path';
import { MCPServerConfig, MCPPermissionRule } from './types.js';

/**
 * Matches a tool name against a wildcard pattern.
 * Supports patterns like:
 * - 'mcp__server__*' - matches all tools from a server
 * - 'mcp__*__read' - matches 'read' tool from any server
 * - 'mcp__server__tool' - exact match
 * - '*' - matches everything
 */
export function matchWildcardPermission(toolName: string, pattern: string): boolean {
  // Exact match
  if (toolName === pattern) {
    return true;
  }

  // Convert pattern to regex
  // Escape special regex characters except *
  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(toolName);
}

/**
 * Checks if a tool is allowed based on a list of permission patterns.
 * Returns true if no patterns are specified (permissive by default).
 */
export function isToolAllowed(toolName: string, permissions?: string[]): boolean {
  // No permissions specified means all tools are allowed
  if (!permissions || permissions.length === 0) {
    return true;
  }

  // Check if any pattern matches
  return permissions.some((pattern) => matchWildcardPermission(toolName, pattern));
}

/**
 * Parses a permission string into a rule.
 * Supports prefix modifiers:
 * - 'allow:pattern' or just 'pattern' - allows matching tools
 * - 'deny:pattern' - denies matching tools
 */
export function parsePermissionRule(permission: string): MCPPermissionRule {
  if (permission.startsWith('deny:')) {
    return {
      pattern: permission.slice(5),
      allowed: false,
    };
  }
  if (permission.startsWith('allow:')) {
    return {
      pattern: permission.slice(6),
      allowed: true,
    };
  }
  // Default to allow
  return {
    pattern: permission,
    allowed: true,
  };
}

/**
 * Evaluates permissions for a tool using allow/deny rules.
 * Deny rules take precedence over allow rules.
 */
export function evaluatePermissions(toolName: string, permissions?: string[]): boolean {
  if (!permissions || permissions.length === 0) {
    return true;
  }

  const rules = permissions.map(parsePermissionRule);
  const allowRules = rules.filter((r) => r.allowed);
  const denyRules = rules.filter((r) => !r.allowed);

  // Check deny rules first - if any match, deny
  for (const rule of denyRules) {
    if (matchWildcardPermission(toolName, rule.pattern)) {
      return false;
    }
  }

  // If there are allow rules, at least one must match
  if (allowRules.length > 0) {
    return allowRules.some((rule) => matchWildcardPermission(toolName, rule.pattern));
  }

  // No allow rules and no deny matches means allowed
  return true;
}

export class MCPConfigManager {
  private configs: Map<string, MCPServerConfig> = new Map();
  private configDir: string;
  private globalPermissions: string[] = [];

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

  /**
   * Set global permissions that apply to all MCP tools
   */
  setGlobalPermissions(permissions: string[]): void {
    this.globalPermissions = permissions;
  }

  /**
   * Get global permissions
   */
  getGlobalPermissions(): string[] {
    return this.globalPermissions;
  }

  /**
   * Check if a tool is allowed based on server and global permissions
   */
  isToolAllowed(serverName: string, toolName: string): boolean {
    const config = this.configs.get(serverName);
    const fullToolName = `mcp__${serverName}__${toolName}`;

    // Check server-specific permissions first
    if (config?.permissions && config.permissions.length > 0) {
      if (!evaluatePermissions(fullToolName, config.permissions)) {
        return false;
      }
    }

    // Check global permissions
    if (this.globalPermissions.length > 0) {
      return evaluatePermissions(fullToolName, this.globalPermissions);
    }

    return true;
  }

  /**
   * Get all allowed tools for a server based on permissions
   */
  filterAllowedTools(serverName: string, toolNames: string[]): string[] {
    return toolNames.filter((toolName) => this.isToolAllowed(serverName, toolName));
  }
}
