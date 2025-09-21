import { Tool, ToolParameter, ToolResult } from '../types/index.js';
import { toolRegistry } from '../tools/ToolRegistry.js';
import { MCPConnectionManager } from './MCPConnectionManager.js';
import { MCPServerConfig, MCPTool, MCPRequest } from './types.js';
import { PermissionManager, ToolNames } from '../utils/PermissionManager.js';

export class MCPToolManager {
  private connectionManager: MCPConnectionManager;
  private serverTools: Map<string, MCPTool[]> = new Map();
  private registeredTools: Map<string, Set<string>> = new Map();
  private permissionManager: PermissionManager | undefined;

  constructor(connectionManager: MCPConnectionManager, permissionManager?: PermissionManager) {
    this.connectionManager = connectionManager;
    this.permissionManager = permissionManager;
  }

  /**
   * Discover and cache tools for a specific server
   */
  async discoverAndRegisterTools(config: MCPServerConfig): Promise<void> {
    const serverName = config.name;
    const protocolHandler = this.connectionManager.getProtocolHandler(serverName);

    if (!protocolHandler) {
      throw new Error(`No protocol handler found for server '${serverName}'`);
    }

    // Discover tools from the server
    const toolsRequest: MCPRequest = {
      jsonrpc: '2.0',
      id: protocolHandler.getNextRequestId(),
      method: 'tools/list',
      params: {},
    };

    const toolsResult = await protocolHandler.sendRequest(toolsRequest);
    const tools: MCPTool[] = toolsResult.tools ?? [];

    // Cache the tools for this server
    this.serverTools.set(serverName, tools);

    // Register tools with fosscode
    this.registerServerTools(serverName, tools);
  }

  /**
   * Register tools for a specific server
   */
  private registerServerTools(serverName: string, tools: MCPTool[]): void {
    if (!this.registeredTools.has(serverName)) {
      this.registeredTools.set(serverName, new Set());
    }

    const registeredForServer = this.registeredTools.get(serverName)!;

    for (const mcpTool of tools) {
      const toolName = `mcp_${serverName}_${mcpTool.name}`;

      // Skip if already registered
      if (registeredForServer.has(toolName)) {
        continue;
      }

      // Create fosscode tool wrapper for MCP tool
      const fosscodeTool: Tool = {
        name: toolName,
        description: mcpTool.description ?? `MCP tool: ${mcpTool.name} (${serverName})`,
        parameters: this.convertMCPParameters(mcpTool),
        execute: async (params: Record<string, any>): Promise<ToolResult> => {
          if (this.permissionManager && !this.permissionManager.canExecute(toolName as ToolNames)) {
            return {
              success: false,
              error: `Tool ${toolName} not allowed in current mode (plan mode)`,
            };
          }
          try {
            const protocolHandler = this.connectionManager.getProtocolHandler(serverName);
            if (!protocolHandler) {
              throw new Error(`Server '${serverName}' is not connected`);
            }

            const callRequest: MCPRequest = {
              jsonrpc: '2.0',
              id: protocolHandler.getNextRequestId(),
              method: 'tools/call',
              params: {
                name: mcpTool.name,
                arguments: params,
              },
            };

            const result = await protocolHandler.sendRequest(callRequest);

            return {
              success: !result.isError,
              data: result.content,
              error: result.isError ? (result.content?.[0]?.text ?? 'Unknown error') : undefined,
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        },
      };

      try {
        toolRegistry.register(fosscodeTool);
        registeredForServer.add(toolName);
      } catch (error) {
        console.warn(`Failed to register MCP tool ${toolName}:`, error);
      }
    }
  }

  /**
   * Unregister all tools for a specific server
   */
  async unregisterServerTools(serverName: string): Promise<void> {
    const registeredForServer = this.registeredTools.get(serverName);
    if (!registeredForServer) {
      return;
    }

    for (const toolName of registeredForServer) {
      try {
        toolRegistry.unregister(toolName);
      } catch (error) {
        console.warn(`Failed to unregister MCP tool ${toolName}:`, error);
      }
    }

    registeredForServer.clear();
    this.registeredTools.delete(serverName);
    this.serverTools.delete(serverName);
  }

  /**
   * Get available tools for a specific server
   */
  getServerTools(serverName: string): MCPTool[] {
    return this.serverTools.get(serverName) ?? [];
  }

  /**
   * Get all registered MCP tools across all servers
   */
  getAllRegisteredTools(): Array<{ serverName: string; toolName: string; mcpTool: MCPTool }> {
    const allTools: Array<{ serverName: string; toolName: string; mcpTool: MCPTool }> = [];

    for (const [serverName, tools] of this.serverTools.entries()) {
      for (const mcpTool of tools) {
        allTools.push({
          serverName,
          toolName: `mcp_${serverName}_${mcpTool.name}`,
          mcpTool,
        });
      }
    }

    return allTools;
  }

  /**
   * Execute tools for a specific server
   */
  async executeServerTools(
    serverName: string,
    toolCalls: Array<{ name: string; arguments: any }>
  ): Promise<any[]> {
    const protocolHandler = this.connectionManager.getProtocolHandler(serverName);
    if (!protocolHandler) {
      throw new Error(`Server '${serverName}' is not connected`);
    }

    const results: any[] = [];

    for (const toolCall of toolCalls) {
      const callRequest: MCPRequest = {
        jsonrpc: '2.0',
        id: protocolHandler.getNextRequestId(),
        method: 'tools/call',
        params: {
          name: toolCall.name,
          arguments: toolCall.arguments,
        },
      };

      try {
        const result = await protocolHandler.sendRequest(callRequest);
        results.push({
          tool: toolCall.name,
          success: !result.isError,
          content: result.content,
          error: result.isError ? result.content : null,
        });
      } catch (error) {
        results.push({
          tool: toolCall.name,
          success: false,
          content: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Format tool results for display
   */
  formatToolResults(results: any[]): string {
    let output = 'MCP Tool Results:\n\n';

    for (const result of results) {
      output += `🔧 Tool: ${result.tool}\n`;
      if (result.success) {
        output += `✅ Success:\n`;
        for (const content of result.content ?? []) {
          if (content.type === 'text') {
            output += `   ${content.text}\n`;
          }
        }
      } else {
        output += `❌ Error: ${result.error}\n`;
      }
      output += '\n';
    }

    return output;
  }

  private convertMCPParameters(mcpTool: MCPTool): ToolParameter[] {
    const parameters: ToolParameter[] = [];

    if (mcpTool.inputSchema.properties) {
      for (const [paramName, paramSchema] of Object.entries(mcpTool.inputSchema.properties)) {
        const isRequired = mcpTool.inputSchema.required?.includes(paramName) ?? false;

        // Convert JSON schema type to fosscode ToolParameter type
        let paramType: 'string' | 'number' | 'boolean' | 'array' = 'string';
        if (typeof paramSchema === 'object' && paramSchema !== null && 'type' in paramSchema) {
          const schemaType = (paramSchema as any).type;
          if (schemaType === 'number' || schemaType === 'integer') {
            paramType = 'number';
          } else if (schemaType === 'boolean') {
            paramType = 'boolean';
          } else if (schemaType === 'array') {
            paramType = 'array';
          }
        }

        parameters.push({
          name: paramName,
          type: paramType,
          description: (paramSchema as any)?.description ?? `Parameter ${paramName}`,
          required: isRequired,
        });
      }
    }
    return parameters;
  }
}
