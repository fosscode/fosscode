import { Message, ProviderResponse, LLMConfig, LLMProvider } from '../types/index.js';
/* eslint-disable @typescript-eslint/no-unused-vars */
import { MCPProtocolHandler } from './utils/MCPProtocolHandler.js';
import { MCPConnectionManager } from './utils/MCPConnectionManager.js';
import { MCPToolManager } from './utils/MCPToolManager.js';
import { MCPMessageParser } from './utils/MCPMessageParser.js';

import { PermissionManager } from '../utils/PermissionManager.js';

export class MCPProvider implements LLMProvider {
  private protocolHandler: MCPProtocolHandler;
  private connectionManager: MCPConnectionManager;
  private toolManager: MCPToolManager;
  private messageParser: MCPMessageParser;

  constructor() {
    this.protocolHandler = new MCPProtocolHandler();
    this.connectionManager = new MCPConnectionManager(this.protocolHandler);
    this.toolManager = new MCPToolManager(this.protocolHandler);
    this.messageParser = new MCPMessageParser();
  }

  async validateConfig(config: LLMConfig): Promise<boolean> {
    return this.connectionManager.validateConfig(config);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async sendMessage(
    messages: Message[],
    config: LLMConfig,
    _mode?: 'code' | 'thinking',
    _chatLogger?: any,
    _permissionManager?: PermissionManager
  ): Promise<ProviderResponse> {
    await this.connectionManager.connectToMCPServer(config);

    // Discover tools if not already done
    await this.toolManager.discoverTools();
    this.toolManager.registerMCPTools();
    this.messageParser.setAvailableTools(this.toolManager.getAvailableTools());

    try {
      // Get the last user message
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role !== 'user') {
        throw new Error('No user message found');
      }

      // Parse the user message to identify tool calls
      const toolCalls = await this.messageParser.parseMessageForToolCalls(lastMessage.content);

      if (toolCalls.length > 0) {
        // Execute the tools and return results
        const toolResults = await this.toolManager.executeTools(toolCalls);
        return {
          content: this.toolManager.formatToolResults(toolResults),
          usage: undefined,
          finishReason: 'stop',
        };
      } else {
        // No tool calls detected, return a simple response
        const availableTools = this.toolManager.getAvailableTools();
        const response =
          `MCP Server Connected\n\n` +
          `Available tools: ${availableTools.map(t => t.name).join(', ') || 'none'}\n\n` +
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
    this.toolManager.unregisterMCPTools();
    this.connectionManager.disconnect();
  }
}
