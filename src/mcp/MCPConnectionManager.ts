import { spawn, ChildProcess } from 'child_process';
import { MCPProtocolHandler } from './MCPProtocolHandler.js';
import { MCPServerConfig, MCPRequest, MCPNotification } from './types.js';

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
  private protocolHandlers: Map<string, MCPProtocolHandler> = new Map();
  private childProcesses: Map<string, ChildProcess> = new Map();

  /**
   * Connect to an MCP server
   */
  async connectServer(config: MCPServerConfig): Promise<MCPProtocolHandler> {
    const serverName = config.name;

    // Check if already connected
    if (this.protocolHandlers.has(serverName)) {
      return this.protocolHandlers.get(serverName)!;
    }

    try {
      // Create new protocol handler for this server
      const protocolHandler = new MCPProtocolHandler();

      // Spawn the MCP server process
      const childProcess = spawn(config.command, config.args ?? [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...config.env },
      });

      protocolHandler.setChildProcess(childProcess);

      // Store references
      this.protocolHandlers.set(serverName, protocolHandler);
      this.childProcesses.set(serverName, childProcess);

      // Basic connection check
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`MCP server '${serverName}' connection timeout`));
        }, config.timeout ?? 5000);

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
      await this.initializeMCP(protocolHandler, config);

      return protocolHandler;
    } catch (error) {
      // Cleanup on failure
      this.disconnectServer(serverName);
      throw new Error(
        `Failed to connect to MCP server '${serverName}': ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnectServer(serverName: string): Promise<void> {
    const protocolHandler = this.protocolHandlers.get(serverName);
    const childProcess = this.childProcesses.get(serverName);

    if (protocolHandler) {
      protocolHandler.disconnect();
      this.protocolHandlers.delete(serverName);
    }

    if (childProcess) {
      childProcess.kill();
      this.childProcesses.delete(serverName);
    }
  }

  /**
   * Get protocol handler for a server
   */
  getProtocolHandler(serverName: string): MCPProtocolHandler | undefined {
    return this.protocolHandlers.get(serverName);
  }

  /**
   * Check if a server is connected
   */
  isConnected(serverName: string): boolean {
    const protocolHandler = this.protocolHandlers.get(serverName);
    return protocolHandler?.isConnected() ?? false;
  }

  /**
   * Get all connected servers
   */
  getConnectedServers(): string[] {
    return Array.from(this.protocolHandlers.keys()).filter(name => this.isConnected(name));
  }

  /**
   * Cleanup all connections
   */
  cleanup(): void {
    for (const serverName of this.protocolHandlers.keys()) {
      this.disconnectServer(serverName);
    }
  }

  private async initializeMCP(
    protocolHandler: MCPProtocolHandler,
    _config: MCPServerConfig
  ): Promise<void> {
    const initRequest: MCPInitializeRequest = {
      jsonrpc: '2.0',
      id: protocolHandler.getNextRequestId(),
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

    await protocolHandler.sendRequest(initRequest);

    // Send initialized notification
    const initializedNotification: MCPNotification = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    };
    protocolHandler.sendNotification(initializedNotification);
  }
}
