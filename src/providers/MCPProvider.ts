import { Message, ProviderResponse, LLMConfig, LLMProvider } from '../types/index.js';
import { MCPConnectionManager } from './mcp/connection.js';
import { MCPRPCManager } from './mcp/rpc.js';
import { MCPToolsManager } from './mcp/tools.js';
import { MCPInitializationManager } from './mcp/initialization.js';

export class MCPProvider implements LLMProvider {
  private connectionManager: MCPConnectionManager;
  private rpcManager: MCPRPCManager;
  private toolsManager: MCPToolsManager;
  private initManager: MCPInitializationManager;

  constructor() {
    this.connectionManager = new MCPConnectionManager();
    this.rpcManager = new MCPRPCManager();
    this.toolsManager = new MCPToolsManager();
    this.initManager = new MCPInitializationManager();
  }

  async validateConfig(config: LLMConfig): Promise<boolean> {
    // Support both legacy single server and new multiple servers
    if (config.mcpServers && Object.keys(config.mcpServers).length > 0) {
      // Validate multiple servers
      for (const serverConfig of Object.values(config.mcpServers)) {
        if (
          serverConfig.enabled !== false &&
          !this.connectionManager.validateConfig(serverConfig)
        ) {
          return false;
        }
      }
      return true;
    }

    // Fall back to legacy single server validation
    return this.connectionManager.validateConfig(config);
  }

  private async connectToMCPServer(config: LLMConfig, serverName?: string): Promise<void> {
    let serverConfig: LLMConfig;

    if (config.mcpServers && serverName) {
      const selectedServer = config.mcpServers[serverName];
      if (!selectedServer || selectedServer.enabled === false) {
        throw new Error(`MCP server '${serverName}' not found or disabled`);
      }
      serverConfig = selectedServer;
    } else if (config.mcpServers && Object.keys(config.mcpServers).length > 0) {
      // Use the first enabled server if no specific server requested
      const enabledServers = Object.values(config.mcpServers).filter(s => s.enabled !== false);
      if (enabledServers.length === 0) {
        throw new Error('No enabled MCP servers found');
      }
      serverConfig = enabledServers[0];
    } else {
      // Fall back to legacy single server config
      serverConfig = config;
    }

    await this.connectionManager.connect(serverConfig);
    this.rpcManager.setupMessageHandler(this.connectionManager);
    await this.initManager.initializeMCP(
      request =>
        this.rpcManager.sendRequest(
          request,
          this.connectionManager.sendRPCMessage.bind(this.connectionManager)
        ),
      this.connectionManager.sendRPCMessage.bind(this.connectionManager),
      this.rpcManager.getNextRequestId.bind(this.rpcManager)
    );
    await this.toolsManager.discoverTools(request =>
      this.rpcManager.sendRequest(
        request,
        this.connectionManager.sendRPCMessage.bind(this.connectionManager)
      )
    );
    this.toolsManager.registerMCPTools(request =>
      this.rpcManager.sendRequest(
        request,
        this.connectionManager.sendRPCMessage.bind(this.connectionManager)
      )
    );
  }

  private async disconnectFromMCPServer(): Promise<void> {
    this.toolsManager.unregisterMCPTools();
    await this.connectionManager.disconnect();
  }

  async sendMessage(
    messages: Message[],
    config: LLMConfig,
    _mode?: 'code' | 'thinking'
  ): Promise<ProviderResponse> {
    // Extract server name from the message if specified (e.g., "use server:context7 ...")
    const lastMessage = messages[messages.length - 1];
    let serverName: string | undefined;

    if (lastMessage && lastMessage.role === 'user') {
      const serverMatch = lastMessage.content.match(/use server:(\w+)/);
      if (serverMatch) {
        serverName = serverMatch[1];
        // Remove the server specification from the message
        lastMessage.content = lastMessage.content.replace(/use server:\w+\s*/, '');
      }
    }

    await this.connectToMCPServer(config, serverName);

    try {
      // Get the last user message
      if (!lastMessage || lastMessage.role !== 'user') {
        throw new Error('No user message found');
      }

      // Parse the user message to identify tool calls
      const toolCalls = this.toolsManager.parseMessageForToolCalls(lastMessage.content);

      if (toolCalls.length > 0) {
        // Execute the tools and return results
        const toolResults = await this.toolsManager.executeTools(toolCalls, request =>
          this.rpcManager.sendRequest(
            request,
            this.connectionManager.sendRPCMessage.bind(this.connectionManager)
          )
        );
        return {
          content: this.toolsManager.formatToolResults(toolResults),
          usage: undefined,
          finishReason: 'stop',
        };
      } else {
        // No tool calls detected, return a simple response
        const serverInfo = this.getCurrentServerInfo(config, serverName);
        const response =
          `MCP Server Connected${serverInfo}\n\n` +
          `Available tools: ${this.toolsManager.availableToolsList.map(t => t.name).join(', ') || 'none'}\n\n` +
          `To use MCP tools, mention them in your message (e.g., "run playwright test").\n` +
          `To use a specific server, prefix with "use server:<name>" (e.g., "use server:context7 run playwright test").`;

        return {
          content: response,
          usage: undefined,
          finishReason: 'stop',
        };
      }
    } catch (error) {
      throw new Error(
        `MCP server error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async listModels(config: LLMConfig): Promise<string[]> {
    // Validate config before proceeding
    if (!this.validateConfig(config)) {
      throw new Error('Invalid MCP server configuration');
    }

    // MCP servers don't have models in the traditional sense
    // Return a single "model" representing the MCP server
    return ['mcp-server'];
  }

  getAvailableMCPServers(config: LLMConfig): string[] {
    if (config.mcpServers) {
      return Object.keys(config.mcpServers).filter(
        name => config.mcpServers![name].enabled !== false
      );
    }
    return [];
  }

  private getCurrentServerInfo(config: LLMConfig, serverName?: string): string {
    if (config.mcpServers && Object.keys(config.mcpServers).length > 1) {
      const availableServers = this.getAvailableMCPServers(config);
      const currentServer =
        serverName ?? (availableServers.length > 0 ? availableServers[0] : 'unknown');
      return ` (${currentServer})`;
    }
    return '';
  }

  // Cleanup method to be called when done
  async cleanup(): Promise<void> {
    await this.disconnectFromMCPServer();
  }
}
