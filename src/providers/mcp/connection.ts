import { spawn } from 'child_process';
import { LLMConfig } from '../../types/index.js';
import { MCPInitializeRequest, MCPNotification } from './types.js';

export class MCPConnectionManager {
  private childProcess: any = null;
  private connected: boolean = false;

  get isConnected(): boolean {
    return this.connected;
  }

  get childProcessInstance(): any {
    return this.childProcess;
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

  async connect(config: LLMConfig): Promise<void> {
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
        // Log the command being executed for debugging
        console.log(
          `🔧 Starting MCP server: ${config.mcpServerCommand} ${config.mcpServerArgs.join(' ')}`
        );

        // Spawn the MCP server process
        this.childProcess = spawn(config.mcpServerCommand, config.mcpServerArgs, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env },
        });

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

  async disconnect(): Promise<void> {
    if (this.childProcess) {
      this.childProcess.kill();
      this.childProcess = null;
    }
    this.connected = false;
  }

  sendRPCMessage(message: MCPInitializeRequest | MCPNotification): void {
    if (!this.childProcess || !this.connected) {
      throw new Error('MCP server not connected');
    }

    const jsonMessage = JSON.stringify(message) + '\n';
    this.childProcess.stdin?.write(jsonMessage);
  }

  setupMessageHandler(onData: (data: Buffer) => void, onError: (data: Buffer) => void): void {
    if (!this.childProcess) return;

    this.childProcess.stdout?.on('data', onData);
    this.childProcess.stderr?.on('data', onError);
  }
}
