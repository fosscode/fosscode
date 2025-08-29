import { Tool, ToolParameter, ToolResult } from '../../types/index.js';
import { toolRegistry } from '../../tools/ToolRegistry.js';
import { MCPProtocolHandler, MCPRequest } from './MCPProtocolHandler.js';

// MCP Tool Types
export interface MCPTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, any>;
    required?: string[];
  };
  outputSchema?: {
    type: 'object';
    properties?: Record<string, any>;
    required?: string[];
  };
}

export class MCPToolManager {
  private protocolHandler: MCPProtocolHandler;
  private availableTools: MCPTool[] = [];
  private registeredMCPTools: Set<string> = new Set();

  constructor(protocolHandler: MCPProtocolHandler) {
    this.protocolHandler = protocolHandler;
  }

  async discoverTools(): Promise<void> {
    const toolsRequest: MCPRequest = {
      jsonrpc: '2.0',
      id: this.protocolHandler.getNextRequestId(),
      method: 'tools/list',
      params: {},
    };

    const toolsResult = await this.protocolHandler.sendRequest(toolsRequest);
    this.availableTools = toolsResult.tools || [];
  }

  getAvailableTools(): MCPTool[] {
    return this.availableTools;
  }

  registerMCPTools(): void {
    for (const mcpTool of this.availableTools) {
      const toolName = `mcp_${mcpTool.name}`;

      // Skip if already registered
      if (this.registeredMCPTools.has(toolName)) {
        continue;
      }

      // Create fosscode tool wrapper for MCP tool
      const fosscodeTool: Tool = {
        name: toolName,
        description: mcpTool.description ?? `MCP tool: ${mcpTool.name}`,
        parameters: this.convertMCPParameters(mcpTool),
        execute: async (params: Record<string, any>): Promise<ToolResult> => {
          try {
            const callRequest: MCPRequest = {
              jsonrpc: '2.0',
              id: this.protocolHandler.getNextRequestId(),
              method: 'tools/call',
              params: {
                name: mcpTool.name,
                arguments: params,
              },
            };

            const result = await this.protocolHandler.sendRequest(callRequest);

            return {
              success: !result.isError,
              data: result.content,
              error: result.isError ? result.content?.[0]?.text || 'Unknown error' : undefined,
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
        this.registeredMCPTools.add(toolName);
      } catch (error) {
        // Tool might already be registered by another instance
        console.warn(`Failed to register MCP tool ${toolName}:`, error);
      }
    }
  }

  unregisterMCPTools(): void {
    for (const toolName of this.registeredMCPTools) {
      toolRegistry.unregister(toolName);
    }
    this.registeredMCPTools.clear();
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
          description: (paramSchema as any)?.description || `Parameter ${paramName}`,
          required: isRequired,
        });
      }
    }
    return parameters;
  }

  async executeTools(toolCalls: Array<{ name: string; arguments: any }>): Promise<any[]> {
    const results: any[] = [];

    for (const toolCall of toolCalls) {
      const callRequest: MCPRequest = {
        jsonrpc: '2.0',
        id: this.protocolHandler.getNextRequestId(),
        method: 'tools/call',
        params: {
          name: toolCall.name,
          arguments: toolCall.arguments,
        },
      };

      try {
        const result = await this.protocolHandler.sendRequest(callRequest);
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

  formatToolResults(results: any[]): string {
    let output = 'MCP Tool Results:\n\n';

    for (const result of results) {
      output += `🔧 Tool: ${result.tool}\n`;
      if (result.success) {
        output += `✅ Success:\n`;
        for (const content of result.content) {
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
}
