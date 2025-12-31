import pc from 'picocolors';
import {
  MCPManager,
  getAllTemplates,
  getTemplatesByCategory,
  getTemplateById,
  searchTemplates,
  getTemplateCategories,
  validateTemplateEnvVars,
  MCPServerTemplate,
  MCPToolDocumentation,
} from '../mcp/index.js';

export class MCPCommand {
  private mcpManager: MCPManager;

  constructor() {
    this.mcpManager = new MCPManager();
  }

  async initialize(): Promise<void> {
    await this.mcpManager.initialize();
  }

  // ==================== Template Commands ====================

  /**
   * List all available templates or filter by category
   */
  async templates(category?: string): Promise<void> {
    let templates: MCPServerTemplate[];

    if (category) {
      const validCategory = category as MCPServerTemplate['category'];
      templates = getTemplatesByCategory(validCategory);
      if (templates.length === 0) {
        console.log(pc.yellow(`No templates found in category: ${category}`));
        console.log(pc.gray(`Available categories: ${getTemplateCategories().join(', ')}`));
        return;
      }
      console.log(pc.blue(`MCP Server Templates (${category}):`));
    } else {
      templates = getAllTemplates();
      console.log(pc.blue('Available MCP Server Templates:'));
    }

    console.log('');

    // Group by category if showing all
    if (!category) {
      const categories = getTemplateCategories();
      for (const cat of categories) {
        const catTemplates = templates.filter((t) => t.category === cat);
        if (catTemplates.length === 0) continue;

        console.log(pc.cyan(`[${cat.toUpperCase()}]`));
        for (const template of catTemplates) {
          this.printTemplateShort(template);
        }
        console.log('');
      }
    } else {
      for (const template of templates) {
        this.printTemplateShort(template);
      }
    }

    console.log(pc.gray('Use "fosscode mcp templates apply <template-id>" to apply a template'));
    console.log(pc.gray('Use "fosscode mcp templates info <template-id>" for details'));
  }

  /**
   * Print short template info
   */
  private printTemplateShort(template: MCPServerTemplate): void {
    const envStatus = validateTemplateEnvVars(template);
    const status = envStatus.valid ? pc.green('ready') : pc.yellow('needs config');
    console.log(`  ${pc.bold(template.id)} - ${template.name} [${status}]`);
    console.log(`    ${pc.gray(template.description)}`);
  }

  /**
   * Show detailed template info
   */
  async templateInfo(templateId: string): Promise<void> {
    const template = getTemplateById(templateId);
    if (!template) {
      console.error(pc.red(`Template not found: ${templateId}`));
      const similar = searchTemplates(templateId);
      if (similar.length > 0) {
        console.log(pc.gray('Did you mean:'));
        for (const t of similar.slice(0, 3)) {
          console.log(pc.gray(`  - ${t.id}`));
        }
      }
      process.exit(1);
    }

    console.log(pc.blue(`Template: ${template.name}`));
    console.log('');
    console.log(`${pc.bold('ID:')} ${template.id}`);
    console.log(`${pc.bold('Category:')} ${template.category}`);
    console.log(`${pc.bold('Description:')} ${template.description}`);
    console.log(`${pc.bold('Command:')} ${template.command} ${template.args?.join(' ') ?? ''}`);

    if (template.requiredEnvVars && template.requiredEnvVars.length > 0) {
      console.log('');
      console.log(pc.bold('Required Environment Variables:'));
      for (const envVar of template.requiredEnvVars) {
        const hasValue = !!process.env[envVar];
        const status = hasValue ? pc.green('set') : pc.red('missing');
        console.log(`  ${envVar} [${status}]`);
      }
    }

    if (template.optionalEnvVars && template.optionalEnvVars.length > 0) {
      console.log('');
      console.log(pc.bold('Optional Environment Variables:'));
      for (const envVar of template.optionalEnvVars) {
        const hasValue = !!process.env[envVar];
        const status = hasValue ? pc.green('set') : pc.gray('not set');
        console.log(`  ${envVar} [${status}]`);
      }
    }

    if (template.documentation) {
      console.log('');
      console.log(pc.bold('Documentation:'));
      console.log(template.documentation);
    }

    if (template.permissions && template.permissions.length > 0) {
      console.log('');
      console.log(pc.bold('Default Permissions:'));
      for (const perm of template.permissions) {
        console.log(`  ${perm}`);
      }
    }
  }

  /**
   * Apply a template to create an MCP server config
   */
  async applyTemplate(templateId: string, serverName?: string): Promise<void> {
    const template = getTemplateById(templateId);
    if (!template) {
      console.error(pc.red(`Template not found: ${templateId}`));
      process.exit(1);
    }

    // Check required env vars
    const envStatus = validateTemplateEnvVars(template);
    if (!envStatus.valid) {
      console.error(pc.red('Missing required environment variables:'));
      for (const envVar of envStatus.missing) {
        console.error(pc.red(`  - ${envVar}`));
      }
      console.log('');
      console.log(pc.gray('Set these variables before applying the template.'));
      process.exit(1);
    }

    const name = serverName ?? template.id;

    try {
      await this.mcpManager.addServerFromTemplate(template, name);
      console.log(pc.green(`Successfully created MCP server config: ${name}`));
      console.log(pc.gray(`Use "fosscode mcp enable ${name}" to activate`));
    } catch (error) {
      console.error(
        pc.red('Failed to apply template:'),
        error instanceof Error ? error.message : 'Unknown error'
      );
      process.exit(1);
    }
  }

  // ==================== Documentation Commands ====================

  /**
   * Show documentation for MCP tools
   */
  async docs(toolName?: string): Promise<void> {
    if (!toolName) {
      // List all available MCP tools with documentation
      const allTools = this.mcpManager.getAllRegisteredTools();

      if (allTools.length === 0) {
        console.log(pc.yellow('No MCP tools currently registered.'));
        console.log(pc.gray('Enable an MCP server first: fosscode mcp enable <server>'));
        return;
      }

      console.log(pc.blue('Available MCP Tools:'));
      console.log('');

      // Group by server
      const byServer = new Map<string, typeof allTools>();
      for (const tool of allTools) {
        const existing = byServer.get(tool.serverName) ?? [];
        existing.push(tool);
        byServer.set(tool.serverName, existing);
      }

      for (const [serverName, tools] of byServer) {
        console.log(pc.cyan(`[${serverName}]`));
        for (const tool of tools) {
          console.log(`  ${pc.bold(tool.mcpTool.name)}`);
          console.log(`    ${pc.gray(tool.mcpTool.description ?? 'No description')}`);
        }
        console.log('');
      }

      console.log(pc.gray('Use "fosscode mcp docs <tool-name>" for detailed documentation'));
      return;
    }

    // Show specific tool documentation
    const doc = this.mcpManager.getToolDocumentation(toolName);
    if (!doc) {
      console.error(pc.red(`Tool not found: ${toolName}`));

      // Try to find similar tools
      const allTools = this.mcpManager.getAllRegisteredTools();
      const similar = allTools.filter(
        (t) =>
          t.mcpTool.name.includes(toolName) ||
          t.toolName.includes(toolName) ||
          toolName.includes(t.mcpTool.name)
      );

      if (similar.length > 0) {
        console.log(pc.gray('Did you mean:'));
        for (const t of similar.slice(0, 5)) {
          console.log(pc.gray(`  - ${t.mcpTool.name} (from ${t.serverName})`));
        }
      }
      process.exit(1);
    }

    this.printToolDocumentation(doc);
  }

  /**
   * Print tool documentation
   */
  private printToolDocumentation(doc: MCPToolDocumentation): void {
    console.log(pc.blue(`Tool: ${doc.toolName}`));
    console.log(`${pc.bold('Server:')} ${doc.serverName}`);
    console.log('');
    console.log(pc.bold('Description:'));
    console.log(`  ${doc.description}`);
    console.log('');

    if (doc.parameters.length > 0) {
      console.log(pc.bold('Parameters:'));
      for (const param of doc.parameters) {
        const required = param.required ? pc.red('*') : '';
        console.log(`  ${pc.cyan(param.name)}${required} (${param.type})`);
        console.log(`    ${pc.gray(param.description)}`);
        if (param.defaultValue !== undefined) {
          console.log(`    ${pc.gray(`Default: ${JSON.stringify(param.defaultValue)}`)}`);
        }
      }
      console.log('');
    }

    if (doc.examples && doc.examples.length > 0) {
      console.log(pc.bold('Examples:'));
      for (const example of doc.examples) {
        console.log(`  ${pc.cyan(example.description)}`);
        console.log(`    Input: ${JSON.stringify(example.input)}`);
        if (example.output) {
          console.log(`    Output: ${example.output}`);
        }
        console.log('');
      }
    }

    if (doc.notes && doc.notes.length > 0) {
      console.log(pc.bold('Notes:'));
      for (const note of doc.notes) {
        console.log(`  - ${note}`);
      }
    }
  }

  // ==================== Health Commands ====================

  /**
   * Show health status of MCP servers
   */
  async health(): Promise<void> {
    const healthStatus = this.mcpManager.getHealthStatus();

    if (healthStatus.length === 0) {
      console.log(pc.yellow('No MCP servers currently enabled.'));
      return;
    }

    console.log(pc.blue('MCP Server Health:'));
    console.log('');

    for (const health of healthStatus) {
      let statusIcon: string;
      let statusColor: (s: string) => string;

      switch (health.status) {
        case 'healthy':
          statusIcon = 'OK';
          statusColor = pc.green;
          break;
        case 'unhealthy':
          statusIcon = 'FAIL';
          statusColor = pc.red;
          break;
        case 'restarting':
          statusIcon = 'RESTART';
          statusColor = pc.yellow;
          break;
        default:
          statusIcon = '?';
          statusColor = pc.gray;
      }

      console.log(`${pc.bold(health.serverName)} [${statusColor(statusIcon)}]`);
      console.log(`  Last check: ${health.lastCheck.toLocaleString()}`);
      console.log(`  Uptime: ${this.formatUptime(health.uptime)}`);
      console.log(`  Restarts: ${health.restartCount}`);

      if (health.lastError) {
        console.log(`  ${pc.red('Last error:')} ${health.lastError}`);
      }
      console.log('');
    }
  }

  /**
   * Format uptime in human-readable format
   */
  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  // ==================== Discovery Commands ====================

  /**
   * Discover and suggest relevant MCP servers based on project
   */
  async discover(): Promise<void> {
    console.log(pc.blue('Discovering relevant MCP servers...'));
    console.log('');

    const suggestions = await this.mcpManager.discoverRelevantServers();

    if (suggestions.length === 0) {
      console.log(pc.gray('No specific recommendations. Here are popular MCP servers:'));
      console.log('');
      const popular = ['filesystem-local', 'git', 'fetch', 'memory'];
      for (const id of popular) {
        const template = getTemplateById(id);
        if (template) {
          this.printTemplateShort(template);
        }
      }
      return;
    }

    console.log(pc.green('Recommended MCP servers for your project:'));
    console.log('');

    for (const suggestion of suggestions) {
      console.log(`${pc.bold(suggestion.template.name)}`);
      console.log(`  ${pc.gray(suggestion.template.description)}`);
      console.log(`  ${pc.cyan('Reason:')} ${suggestion.reason}`);
      console.log(`  ${pc.gray(`Apply with: fosscode mcp templates apply ${suggestion.template.id}`)}`);
      console.log('');
    }
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

      case 'templates': {
        // Handle templates subcommands
        const templateSubcommand = args[0];
        switch (templateSubcommand) {
          case 'apply':
            if (args.length < 2) {
              console.error(pc.red('Error: Please specify a template ID'));
              console.log(pc.gray('Usage: fosscode mcp templates apply <template-id> [server-name]'));
              process.exit(1);
            }
            await this.applyTemplate(args[1], args[2]);
            break;
          case 'info':
            if (args.length < 2) {
              console.error(pc.red('Error: Please specify a template ID'));
              console.log(pc.gray('Usage: fosscode mcp templates info <template-id>'));
              process.exit(1);
            }
            await this.templateInfo(args[1]);
            break;
          default:
            // List templates, optionally filtered by category
            await this.templates(templateSubcommand);
        }
        break;
      }

      case 'docs':
        await this.docs(args[0]);
        break;

      case 'health':
        await this.health();
        break;

      case 'discover':
        await this.discover();
        break;

      default:
        console.error(pc.red(`Unknown subcommand: ${subcommand}`));
        console.log(pc.gray('Available subcommands:'));
        console.log(pc.gray('  list       - List configured MCP servers'));
        console.log(pc.gray('  status     - Show server status'));
        console.log(pc.gray('  enable     - Enable MCP server(s)'));
        console.log(pc.gray('  disable    - Disable MCP server(s)'));
        console.log(pc.gray('  templates  - List/apply MCP server templates'));
        console.log(pc.gray('  docs       - Show tool documentation'));
        console.log(pc.gray('  health     - Show server health status'));
        console.log(pc.gray('  discover   - Discover relevant MCP servers'));
        process.exit(1);
    }
  }
}
