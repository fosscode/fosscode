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
    return this.connectionManager.validateConfig(config);
  }

  private async connectToMCPServer(config: LLMConfig): Promise<void> {
    await this.connectionManager.connect(config);
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
    await this.connectToMCPServer(config);

    try {
      // Get the last user message
      const lastMessage = messages[messages.length - 1];
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
        const response =
          `MCP Server Connected\n\n` +
          `Available tools: ${this.toolsManager.availableToolsList.map(t => t.name).join(', ') || 'none'}\n\n` +
          `To use MCP tools, mention them in your message (e.g., "run playwright test").`;

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

  // Cleanup method to be called when done
  async cleanup(): Promise<void> {
    await this.disconnectFromMCPServer();
  }
}
