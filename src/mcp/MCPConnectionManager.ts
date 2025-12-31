import { spawn, ChildProcess } from 'child_process';
import { MCPProtocolHandler } from './MCPProtocolHandler.js';
import { MCPServerConfig, MCPRequest, MCPNotification, MCPServerHealth } from './types.js';

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

// Health check ping request
interface MCPPingRequest extends MCPRequest {
  method: 'ping';
}

// Event types for health monitoring
export type MCPHealthEvent =
  | { type: 'healthy'; serverName: string }
  | { type: 'unhealthy'; serverName: string; error: string }
  | { type: 'restarting'; serverName: string; attempt: number }
  | { type: 'restarted'; serverName: string }
  | { type: 'restart_failed'; serverName: string; error: string };

export type MCPHealthEventHandler = (event: MCPHealthEvent) => void;

export class MCPConnectionManager {
  private protocolHandlers: Map<string, MCPProtocolHandler> = new Map();
  private childProcesses: Map<string, ChildProcess> = new Map();
  private serverConfigs: Map<string, MCPServerConfig> = new Map();
  private healthStatus: Map<string, MCPServerHealth> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private restartCounts: Map<string, number> = new Map();
  private startTimes: Map<string, Date> = new Map();
  private healthEventHandlers: MCPHealthEventHandler[] = [];

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
      this.serverConfigs.set(serverName, config);
      this.startTimes.set(serverName, new Date());
      this.restartCounts.set(serverName, 0);

      // Initialize health status
      this.healthStatus.set(serverName, {
        serverName,
        status: 'unknown',
        lastCheck: new Date(),
        restartCount: 0,
        uptime: 0,
      });

      // Set up process exit handler for auto-restart
      childProcess.on('exit', (code, signal) => {
        this.handleProcessExit(serverName, code, signal);
      });

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

      // Start health monitoring if enabled
      if (config.healthCheckInterval && config.healthCheckInterval > 0) {
        this.startHealthMonitoring(serverName, config.healthCheckInterval);
      }

      // Update health status to healthy
      this.updateHealthStatus(serverName, 'healthy');

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
    // Stop health monitoring
    this.stopHealthMonitoring(serverName);

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

    // Clean up tracking data
    this.serverConfigs.delete(serverName);
    this.healthStatus.delete(serverName);
    this.restartCounts.delete(serverName);
    this.startTimes.delete(serverName);
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

  // ==================== Health Monitoring ====================

  /**
   * Register a handler for health events
   */
  onHealthEvent(handler: MCPHealthEventHandler): void {
    this.healthEventHandlers.push(handler);
  }

  /**
   * Remove a health event handler
   */
  offHealthEvent(handler: MCPHealthEventHandler): void {
    const index = this.healthEventHandlers.indexOf(handler);
    if (index !== -1) {
      this.healthEventHandlers.splice(index, 1);
    }
  }

  /**
   * Emit a health event to all handlers
   */
  private emitHealthEvent(event: MCPHealthEvent): void {
    for (const handler of this.healthEventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in health event handler:', error);
      }
    }
  }

  /**
   * Start health monitoring for a server
   */
  startHealthMonitoring(serverName: string, intervalMs: number = 30000): void {
    // Stop existing monitoring if any
    this.stopHealthMonitoring(serverName);

    const interval = setInterval(async () => {
      await this.performHealthCheck(serverName);
    }, intervalMs);

    this.healthCheckIntervals.set(serverName, interval);
  }

  /**
   * Stop health monitoring for a server
   */
  stopHealthMonitoring(serverName: string): void {
    const interval = this.healthCheckIntervals.get(serverName);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(serverName);
    }
  }

  /**
   * Perform a health check on a server
   */
  async performHealthCheck(serverName: string): Promise<MCPServerHealth> {
    const protocolHandler = this.protocolHandlers.get(serverName);
    const currentHealth = this.healthStatus.get(serverName);

    if (!protocolHandler || !currentHealth) {
      return {
        serverName,
        status: 'unknown',
        lastCheck: new Date(),
        restartCount: this.restartCounts.get(serverName) ?? 0,
        uptime: 0,
      };
    }

    try {
      // Send a ping request to check if server is responsive
      const pingRequest: MCPPingRequest = {
        jsonrpc: '2.0',
        id: protocolHandler.getNextRequestId(),
        method: 'ping',
      };

      // Use a short timeout for health checks
      const pingPromise = protocolHandler.sendRequest(pingRequest);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), 5000)
      );

      await Promise.race([pingPromise, timeoutPromise]);

      // Update health status
      this.updateHealthStatus(serverName, 'healthy');
      this.emitHealthEvent({ type: 'healthy', serverName });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateHealthStatus(serverName, 'unhealthy', errorMessage);
      this.emitHealthEvent({ type: 'unhealthy', serverName, error: errorMessage });

      // Attempt auto-restart if enabled
      const config = this.serverConfigs.get(serverName);
      if (config?.autoRestart !== false) {
        await this.attemptRestart(serverName);
      }
    }

    return this.healthStatus.get(serverName)!;
  }

  /**
   * Update health status for a server
   */
  private updateHealthStatus(
    serverName: string,
    status: MCPServerHealth['status'],
    error?: string
  ): void {
    const startTime = this.startTimes.get(serverName);
    const uptime = startTime ? Date.now() - startTime.getTime() : 0;

    const healthRecord: MCPServerHealth = {
      serverName,
      status,
      lastCheck: new Date(),
      restartCount: this.restartCounts.get(serverName) ?? 0,
      uptime,
    };

    if (error) {
      healthRecord.lastError = error;
    }

    this.healthStatus.set(serverName, healthRecord);
  }

  /**
   * Handle process exit for auto-restart
   */
  private handleProcessExit(
    serverName: string,
    code: number | null,
    signal: NodeJS.Signals | null
  ): void {
    // Don't restart if we intentionally disconnected
    if (!this.serverConfigs.has(serverName)) {
      return;
    }

    const config = this.serverConfigs.get(serverName);
    if (config?.autoRestart !== false) {
      const error = `Process exited with code ${code ?? 'null'}, signal ${signal ?? 'null'}`;
      this.updateHealthStatus(serverName, 'unhealthy', error);
      this.emitHealthEvent({ type: 'unhealthy', serverName, error });
      this.attemptRestart(serverName);
    }
  }

  /**
   * Attempt to restart a server
   */
  private async attemptRestart(serverName: string): Promise<void> {
    const config = this.serverConfigs.get(serverName);
    if (!config) {
      return;
    }

    const maxAttempts = config.maxRestartAttempts ?? 3;
    const currentAttempts = (this.restartCounts.get(serverName) ?? 0) + 1;

    if (currentAttempts > maxAttempts) {
      this.emitHealthEvent({
        type: 'restart_failed',
        serverName,
        error: `Max restart attempts (${maxAttempts}) exceeded`,
      });
      return;
    }

    this.restartCounts.set(serverName, currentAttempts);
    this.updateHealthStatus(serverName, 'restarting');
    this.emitHealthEvent({ type: 'restarting', serverName, attempt: currentAttempts });

    try {
      // Clean up existing connections without removing config
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

      // Wait a bit before restarting
      await new Promise((resolve) => setTimeout(resolve, 1000 * currentAttempts));

      // Reconnect
      await this.connectServer(config);

      this.emitHealthEvent({ type: 'restarted', serverName });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateHealthStatus(serverName, 'unhealthy', errorMessage);

      // Retry if we haven't exceeded max attempts
      if (currentAttempts < maxAttempts) {
        setTimeout(() => this.attemptRestart(serverName), 5000);
      } else {
        this.emitHealthEvent({
          type: 'restart_failed',
          serverName,
          error: errorMessage,
        });
      }
    }
  }

  /**
   * Get health status for a specific server
   */
  getServerHealth(serverName: string): MCPServerHealth | undefined {
    return this.healthStatus.get(serverName);
  }

  /**
   * Get health status for all servers
   */
  getAllServerHealth(): MCPServerHealth[] {
    return Array.from(this.healthStatus.values());
  }

  /**
   * Force a health check on all connected servers
   */
  async checkAllServersHealth(): Promise<MCPServerHealth[]> {
    const results: MCPServerHealth[] = [];
    for (const serverName of this.protocolHandlers.keys()) {
      const health = await this.performHealthCheck(serverName);
      results.push(health);
    }
    return results;
  }

  /**
   * Get restart count for a server
   */
  getRestartCount(serverName: string): number {
    return this.restartCounts.get(serverName) ?? 0;
  }

  /**
   * Reset restart count for a server
   */
  resetRestartCount(serverName: string): void {
    this.restartCounts.set(serverName, 0);
  }

  /**
   * Get uptime for a server in milliseconds
   */
  getServerUptime(serverName: string): number {
    const startTime = this.startTimes.get(serverName);
    return startTime ? Date.now() - startTime.getTime() : 0;
  }
}
