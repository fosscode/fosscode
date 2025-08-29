import { spawn } from 'child_process';
import { LLMConfig } from '../../types/index.js';
import { MCPProtocolHandler, MCPRequest, MCPNotification } from './MCPProtocolHandler.js';

// MCP Protocol Types
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

export class MCPConnectionManager {
  private protocolHandler: MCPProtocolHandler;

  constructor(protocolHandler: MCPProtocolHandler) {
    this.protocolHandler = protocolHandler;
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

  async connectToMCPServer(config: LLMConfig): Promise<void> {
    if (!config) {
      throw new Error('Config is required');
    }
    if (!this.validateConfig(config)) {
      throw new Error('Invalid MCP server configuration');
    }

    if (this.protocolHandler.isConnected()) {
      return; // Already connected
    }

    try {
      if (config.mcpServerCommand && config.mcpServerArgs) {
        // Spawn the MCP server process
        const childProcess = spawn(config.mcpServerCommand, config.mcpServerArgs, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env },
        });

        this.protocolHandler.setChildProcess(childProcess);

        // Basic connection check - wait a moment for the process to start
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('MCP server connection timeout'));
          }, 5000);

          childProcess.on('error', (error: Error) => {
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
      } else {
        throw new Error('URL-based MCP servers not yet implemented');
      }
    } catch (error) {
      throw new Error(
        `Failed to connect to MCP server: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async initializeMCP(_config: LLMConfig): Promise<void> {
    const initRequest: MCPInitializeRequest = {
      jsonrpc: '2.0',
      id: this.protocolHandler.getNextRequestId(),
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

    await this.protocolHandler.sendRequest(initRequest);

    // Send initialized notification
    const initializedNotification: MCPNotification = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    };
    this.protocolHandler.sendNotification(initializedNotification);
  }

  disconnect(): void {
    this.protocolHandler.disconnect();
  }
}
