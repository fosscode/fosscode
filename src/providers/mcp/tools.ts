import { Tool, ToolParameter, ToolResult } from '../../types/index.js';
import { toolRegistry } from '../../tools/ToolRegistry.js';
import { MCPTool, MCPRequest } from './types.js';

export class MCPToolsManager {
  private availableTools: MCPTool[] = [];
  private registeredMCPTools: Set<string> = new Set();

  get availableToolsList(): MCPTool[] {
    return this.availableTools;
  }

  async discoverTools(sendRequest: (request: MCPRequest) => Promise<any>): Promise<void> {
    const toolsRequest: MCPRequest = {
      jsonrpc: '2.0',
      id: 1, // Will be set by caller
      method: 'tools/list',
      params: {},
    };

    const toolsResult = await sendRequest(toolsRequest);
    this.availableTools = toolsResult.tools || [];
  }

  registerMCPTools(sendRequest: (request: MCPRequest) => Promise<any>): void {
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
              id: 1, // Will be set by caller
              method: 'tools/call',
              params: {
                name: mcpTool.name,
                arguments: params,
              },
            };

            const result = await sendRequest(callRequest);

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

  parseMessageForToolCalls(message: string): Array<{ name: string; arguments: any }> {
    const toolCalls: Array<{ name: string; arguments: any }> = [];

    // Simple pattern matching for tool calls
    // This is a basic implementation - in a real system you'd use NLP or more sophisticated parsing
    for (const tool of this.availableTools) {
      const toolNamePattern = new RegExp(`\\b${tool.name}\\b`, 'i');
      if (toolNamePattern.test(message)) {
        // Extract arguments from the message (simplified approach)
        const args: any = {};

        // Try to extract arguments based on the tool's input schema
        if (tool.inputSchema.properties) {
          for (const [propName] of Object.entries(tool.inputSchema.properties)) {
            // Simple argument extraction - look for patterns like "argName: value"
            const argPattern = new RegExp(`${propName}\\s*:\\s*([^\\s,]+)`, 'i');
            const match = message.match(argPattern);
            if (match) {
              args[propName] = match[1];
            }
          }
        }

        toolCalls.push({
          name: tool.name,
          arguments: args,
        });
      }
    }

    return toolCalls;
  }

  async executeTools(
    toolCalls: Array<{ name: string; arguments: any }>,
    sendRequest: (request: MCPRequest) => Promise<any>
  ): Promise<any[]> {
    const results: any[] = [];

    for (const toolCall of toolCalls) {
      const callRequest: MCPRequest = {
        jsonrpc: '2.0',
        id: 1, // Will be set by caller
        method: 'tools/call',
        params: {
          name: toolCall.name,
          arguments: toolCall.arguments,
        },
      };

      try {
        const result = await sendRequest(callRequest);
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
}
