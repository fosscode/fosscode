import { ChildProcess } from 'child_process';
import { MCPRequest, MCPResponse, MCPNotification } from './types.js';

export class MCPProtocolHandler {
  private childProcess: ChildProcess | null = null;
  private connected: boolean = false;
  private nextRequestId: number = 1;
  private pendingRequests: Map<
    number | string,
    { resolve: (_value: any) => void; reject: (_error: Error) => void }
  > = new Map();

  setChildProcess(process: ChildProcess): void {
    this.childProcess = process;
    this.connected = true;
    this.setupMessageHandler();
  }

  private sendRPCMessage(message: MCPRequest | MCPNotification): void {
    if (!this.childProcess || !this.connected) {
      throw new Error('MCP server not connected');
    }

    const jsonMessage = JSON.stringify(message) + '\n';
    this.childProcess.stdin?.write(jsonMessage);
  }

  async sendRequest(request: MCPRequest): Promise<any> {
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

  sendNotification(notification: MCPNotification): void {
    this.sendRPCMessage(notification);
  }

  getNextRequestId(): number {
    return this.nextRequestId++;
  }

  disconnect(): void {
    if (this.childProcess) {
      this.childProcess.kill();
      this.childProcess = null;
    }
    this.connected = false;
    this.pendingRequests.clear();
  }

  isConnected(): boolean {
    return this.connected;
  }
}
