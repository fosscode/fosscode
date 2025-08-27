import { spawn } from 'child_process';
import {
  Message,
  ProviderResponse,
  LLMConfig,
  LLMProvider,
  Tool,
  ToolParameter,
  ToolResult,
} from '../types/index.js';
import { toolRegistry } from '../tools/ToolRegistry.js';

// MCP Protocol Types
interface MCPRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

interface MCPTool {
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

interface MCPInitializeRequest extends MCPRequest {
  method: 'initialize';
  params: {
    protocolVersion: string;
    capabilities: {
      tools?: object;
      resources?: object;
      prompts?: object;
      sampling?: object;
      elicitation?: object;
    };
    clientInfo: {
      name: string;
      title?: string;
      version: string;
    };
  };
}

interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: {
    tools?: { listChanged?: boolean };
    resources?: { listChanged?: boolean; subscribe?: boolean };
    prompts?: { listChanged?: boolean };
    logging?: object;
  };
  serverInfo: {
    name: string;
    title?: string;
    version: string;
  };
  instructions?: string;
}

export class MCPProvider implements LLMProvider {
  private childProcess: any = null;
  private connected: boolean = false;
  private nextRequestId: number = 1;
  private pendingRequests: Map<
    number | string,
    { resolve: (value: any) => void; reject: (error: Error) => void }
  > = new Map();
  private availableTools: MCPTool[] = [];
  private registeredMCPTools: Set<string> = new Set();

  private sendRPCMessage(message: MCPRequest | MCPNotification): void {
    if (!this.childProcess || !this.connected) {
      throw new Error('MCP server not connected');
    }

    const jsonMessage = JSON.stringify(message) + '\n';
    this.childProcess.stdin?.write(jsonMessage);
  }

  private async sendRequest(request: MCPRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = request.id;
      this.pendingRequests.set(id, { resolve, reject });

      // Set timeout for request
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`MCP request timeout: ${request.method}`));
      }, 30000); // 30 second timeout

      // Store timeout for cleanup
      const originalResolve = resolve;
      const originalReject = reject;

      resolve = (result: any) => {
        clearTimeout(timeout);
        originalResolve(result);
      };

      reject = (error: any) => {
        clearTimeout(timeout);
        originalReject(error);
      };

      this.pendingRequests.set(id, { resolve, reject });
      this.sendRPCMessage(request);
    });
  }

  private handleResponse(response: MCPResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      return; // No pending request for this ID
    }

    this.pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(new Error(`MCP Error ${response.error.code}: ${response.error.message}`));
    } else {
      pending.resolve(response.result);
    }
  }

  private setupMessageHandler(): void {
    if (!this.childProcess) return;

    let buffer = '';

    this.childProcess.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();

      // Process complete JSON-RPC messages (one per line)
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const message = JSON.parse(line.trim());
          if (message.id !== undefined) {
            // This is a response
            this.handleResponse(message as MCPResponse);
          } else {
            // This is a notification (we'll handle these later if needed)
            this.handleNotification(message as MCPNotification);
          }
        } catch (error) {
          console.error('Failed to parse MCP message:', error, line);
        }
      }
    });

    this.childProcess.stderr?.on('data', (data: Buffer) => {
      console.error('MCP server stderr:', data.toString());
    });
  }

  private handleNotification(notification: MCPNotification): void {
    // Handle notifications from the MCP server
    // For now, we'll just log them
    console.log('MCP notification:', notification.method, notification.params);
  }

  async validateConfig(config: LLMConfig): Promise<boolean> {
    // For MCP, we need either a command with args or a URL
    if (config.mcpServerUrl) {
      return true; // URL-based connection (not implemented yet)
    }

    if (config.mcpServerCommand && config.mcpServerArgs && config.mcpServerArgs.length > 0) {
      return true; // Command-based connection
    }

    return false;
  }

  private async connectToMCPServer(config: LLMConfig): Promise<void> {
    // Use config to avoid unused parameter warning
    if (!config) {
      throw new Error('Config is required');
    }
    if (!this.validateConfig(config)) {
      throw new Error('Invalid MCP server configuration');
    }

    if (this.connected) {
      return; // Already connected
    }

    try {
      if (config.mcpServerCommand && config.mcpServerArgs) {
        // Spawn the MCP server process
        this.childProcess = spawn(config.mcpServerCommand, config.mcpServerArgs, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env },
        });

        // Setup message handler for JSON-RPC communication
        this.setupMessageHandler();

        // Basic connection check - wait a moment for the process to start
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('MCP server connection timeout'));
          }, 5000);

          this.childProcess.on('error', (error: Error) => {
            clearTimeout(timeout);
            reject(error);
          });

          // If process starts without immediate error, consider it connected
          setTimeout(() => {
            clearTimeout(timeout);
            resolve(true);
          }, 1000);
        });

        // Perform MCP initialization handshake
        await this.initializeMCP(config);

        this.connected = true;
      } else {
        throw new Error('URL-based MCP servers not yet implemented');
      }
    } catch (error) {
      throw new Error(
        `Failed to connect to MCP server: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async disconnectFromMCPServer(): Promise<void> {
    // Unregister MCP tools from fosscode's tool system
    this.unregisterMCPTools();

    if (this.childProcess) {
      this.childProcess.kill();
      this.childProcess = null;
    }
    this.connected = false;
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
      const toolCalls = await this.parseMessageForToolCalls(lastMessage.content);

      if (toolCalls.length > 0) {
        // Execute the tools and return results
        const toolResults = await this.executeTools(toolCalls);
        return {
          content: this.formatToolResults(toolResults),
          usage: undefined,
          finishReason: 'stop',
        };
      } else {
        // No tool calls detected, return a simple response
        const response =
          `MCP Server Connected\n\n` +
          `Available tools: ${this.availableTools.map(t => t.name).join(', ') || 'none'}\n\n` +
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

  private async initializeMCP(_config: LLMConfig): Promise<void> {
    const initRequest: MCPInitializeRequest = {
      jsonrpc: '2.0',
      id: this.nextRequestId++,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
          sampling: {},
          elicitation: {},
        },
        clientInfo: {
          name: 'fosscode',
          title: 'Fosscode MCP Client',
          version: '0.0.12',
        },
      },
    };

    (await this.sendRequest(initRequest)) as MCPInitializeResult;

    // Send initialized notification
    const initializedNotification: MCPNotification = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    };
    this.sendRPCMessage(initializedNotification);

    // Discover available tools
    await this.discoverTools();

    // Register MCP tools with fosscode's tool system
    this.registerMCPTools();
  }

  private async discoverTools(): Promise<void> {
    const toolsRequest: MCPRequest = {
      jsonrpc: '2.0',
      id: this.nextRequestId++,
      method: 'tools/list',
      params: {},
    };

    const toolsResult = await this.sendRequest(toolsRequest);
    this.availableTools = toolsResult.tools || [];
  }

  private async parseMessageForToolCalls(
    message: string
  ): Promise<Array<{ name: string; arguments: any }>> {
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

  private async executeTools(toolCalls: Array<{ name: string; arguments: any }>): Promise<any[]> {
    const results: any[] = [];

    for (const toolCall of toolCalls) {
      const callRequest: MCPRequest = {
        jsonrpc: '2.0',
        id: this.nextRequestId++,
        method: 'tools/call',
        params: {
          name: toolCall.name,
          arguments: toolCall.arguments,
        },
      };

      try {
        const result = await this.sendRequest(callRequest);
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

  private formatToolResults(results: any[]): string {
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

  private registerMCPTools(): void {
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
              id: this.nextRequestId++,
              method: 'tools/call',
              params: {
                name: mcpTool.name,
                arguments: params,
              },
            };

            const result = await this.sendRequest(callRequest);

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

  private unregisterMCPTools(): void {
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
}
