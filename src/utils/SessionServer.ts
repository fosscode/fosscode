import { EventEmitter } from 'events';
import { SessionState, SessionManager } from './SessionManager.js';
import { Message, ProviderType } from '../types/index.js';

/**
 * WebSocket message types for session control
 */
export type SessionMessageType =
  | 'connect'
  | 'disconnect'
  | 'message'
  | 'response'
  | 'status'
  | 'error'
  | 'session_state'
  | 'command';

/**
 * Session control message structure
 */
export interface SessionMessage {
  type: SessionMessageType;
  id: string;
  timestamp: string;
  payload: SessionPayload;
}

/**
 * Session payload types
 */
export type SessionPayload =
  | ConnectPayload
  | MessagePayload
  | ResponsePayload
  | StatusPayload
  | ErrorPayload
  | SessionStatePayload
  | CommandPayload;

export interface ConnectPayload {
  clientId: string;
  clientName?: string;
}

export interface MessagePayload {
  content: string;
  attachedFiles?: string[];
}

export interface ResponsePayload {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  thinkingBlocks?: string[];
}

export interface StatusPayload {
  status: 'idle' | 'processing' | 'error';
  currentProvider?: ProviderType;
  currentModel?: string;
  messageCount?: number;
}

export interface ErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface SessionStatePayload {
  session: SessionState;
}

export interface CommandPayload {
  command: string;
  args?: string[];
}

/**
 * Session server configuration
 */
export interface SessionServerConfig {
  port: number;
  host?: string;
  maxClients?: number;
  authToken?: string;
  sessionManager: SessionManager;
}

/**
 * Connected client information
 */
export interface ConnectedClient {
  id: string;
  name?: string;
  connectedAt: Date;
  lastActivity: Date;
}

/**
 * Session server events
 */
export interface SessionServerEvents {
  clientConnected: (client: ConnectedClient) => void;
  clientDisconnected: (clientId: string) => void;
  messageReceived: (clientId: string, message: SessionMessage) => void;
  error: (error: Error) => void;
  started: (port: number) => void;
  stopped: () => void;
}

/**
 * Session server for remote session control
 * Provides WebSocket-based interface for external clients to interact with fosscode sessions
 */
export class SessionServer extends EventEmitter {
  private config: SessionServerConfig;
  private clients: Map<string, ConnectedClient> = new Map();
  private isRunning = false;
  private server: unknown = null;
  private messageHandlers: Map<
    SessionMessageType,
    (clientId: string, message: SessionMessage) => Promise<SessionMessage | null>
  > = new Map();

  constructor(config: SessionServerConfig) {
    super();
    this.config = {
      host: '127.0.0.1',
      maxClients: 10,
      ...config,
    };
    this.setupMessageHandlers();
  }

  /**
   * Set up default message handlers
   */
  private setupMessageHandlers(): void {
    // Handle connect messages
    this.messageHandlers.set('connect', async (clientId, message) => {
      const payload = message.payload as ConnectPayload;
      const client: ConnectedClient = {
        id: clientId,
        connectedAt: new Date(),
        lastActivity: new Date(),
        ...(payload.clientName && { name: payload.clientName }),
      };
      this.clients.set(clientId, client);
      this.emit('clientConnected', client);

      const session = this.config.sessionManager.getCurrentSession();
      return this.createMessage('status', {
        status: 'idle',
        messageCount: session?.messages.length ?? 0,
        ...(session?.provider && { currentProvider: session.provider }),
        ...(session?.model && { currentModel: session.model }),
      });
    });

    // Handle disconnect messages
    this.messageHandlers.set('disconnect', async clientId => {
      this.clients.delete(clientId);
      this.emit('clientDisconnected', clientId);
      return null;
    });

    // Handle incoming chat messages
    this.messageHandlers.set('message', async (clientId, message) => {
      // MessagePayload contains content and attachedFiles for processing
      this.updateClientActivity(clientId);

      // Emit event for message processing
      this.emit('messageReceived', clientId, message);

      // The actual message processing would be handled by the chat system
      // This just acknowledges receipt
      const session = this.config.sessionManager.getCurrentSession();
      return this.createMessage('status', {
        status: 'processing',
        ...(session?.provider && { currentProvider: session.provider }),
        ...(session?.model && { currentModel: session.model }),
      });
    });

    // Handle command messages
    this.messageHandlers.set('command', async (clientId, message) => {
      const payload = message.payload as CommandPayload;
      this.updateClientActivity(clientId);

      try {
        const result = await this.handleCommand(payload.command, payload.args);
        return this.createMessage('response', {
          content: result,
        });
      } catch (error) {
        return this.createMessage('error', {
          code: 'COMMAND_ERROR',
          message: error instanceof Error ? error.message : 'Command execution failed',
        });
      }
    });
  }

  /**
   * Handle session commands
   */
  private async handleCommand(command: string, args?: string[]): Promise<string> {
    const sessionManager = this.config.sessionManager;

    switch (command) {
      case 'status':
        const session = sessionManager.getCurrentSession();
        if (!session) {
          return 'No active session';
        }
        return JSON.stringify(
          {
            id: session.id,
            name: session.name,
            provider: session.provider,
            model: session.model,
            messageCount: session.messages.length,
          },
          null,
          2
        );

      case 'list':
        const sessions = await sessionManager.listSessions();
        return JSON.stringify(sessions, null, 2);

      case 'save':
        const savedId = await sessionManager.saveSession();
        return `Session saved: ${savedId}`;

      case 'load':
        if (!args?.[0]) {
          throw new Error('Session ID required');
        }
        await sessionManager.loadSession(args[0]);
        return `Session loaded: ${args[0]}`;

      case 'clear':
        sessionManager.clearCurrentSession();
        return 'Session cleared';

      case 'history':
        const currentSession = sessionManager.getCurrentSession();
        if (!currentSession) {
          return 'No active session';
        }
        return currentSession.messages
          .map(m => `[${m.role}] ${m.content.substring(0, 100)}...`)
          .join('\n');

      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  /**
   * Start the session server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }

    // Create a simple HTTP server with WebSocket upgrade capability
    // Note: In production, you'd use a proper WebSocket library like 'ws'
    // This is a foundation that can be extended
    const http = await import('http');

    const server = http.createServer((req, res) => {
      // Handle HTTP requests for health checks
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'healthy',
            clients: this.clients.size,
            uptime: process.uptime(),
          })
        );
        return;
      }

      if (req.url === '/api/session') {
        const session = this.config.sessionManager.getCurrentSession();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify(
            session
              ? {
                  id: session.id,
                  name: session.name,
                  provider: session.provider,
                  model: session.model,
                  messageCount: session.messages.length,
                }
              : null
          )
        );
        return;
      }

      if (req.url === '/api/messages' && req.method === 'GET') {
        const session = this.config.sessionManager.getCurrentSession();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(session?.messages ?? []));
        return;
      }

      // Handle POST messages
      if (req.url === '/api/message' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            if (!data.content) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Content is required' }));
              return;
            }

            // Create a session message event
            const clientId = `http_${Date.now()}`;
            const message = this.createMessage('message', {
              content: data.content,
              attachedFiles: data.attachedFiles,
            });

            this.emit('messageReceived', clientId, message);

            res.writeHead(202, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                status: 'accepted',
                messageId: message.id,
              })
            );
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: error instanceof Error ? error.message : 'Invalid request',
              })
            );
          }
        });
        return;
      }

      // Default 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    // Store server reference
    this.server = server;

    return new Promise((resolve, reject) => {
      server.listen(this.config.port, this.config.host, () => {
        this.isRunning = true;
        this.emit('started', this.config.port);
        resolve();
      });

      server.on('error', error => {
        this.emit('error', error);
        reject(error);
      });
    });
  }

  /**
   * Stop the session server
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.server) {
      return;
    }

    return new Promise(resolve => {
      const server = this.server as { close: (callback: () => void) => void };
      server.close(() => {
        this.isRunning = false;
        this.clients.clear();
        this.emit('stopped');
        resolve();
      });
    });
  }

  /**
   * Send a message to a specific client
   */
  async sendToClient(clientId: string, message: SessionMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    // In a full WebSocket implementation, this would send via the socket
    // For HTTP clients, this would be handled via response or polling
    this.emit('messageSent', clientId, message);
  }

  /**
   * Broadcast a message to all connected clients
   */
  async broadcast(message: SessionMessage): Promise<void> {
    for (const clientId of this.clients.keys()) {
      await this.sendToClient(clientId, message);
    }
  }

  /**
   * Send response to all clients
   */
  async broadcastResponse(response: Message): Promise<void> {
    const message = this.createMessage('response', {
      content: response.content,
      usage: response.usage,
    });
    await this.broadcast(message);
  }

  /**
   * Send status update to all clients
   */
  async broadcastStatus(status: 'idle' | 'processing' | 'error'): Promise<void> {
    const session = this.config.sessionManager.getCurrentSession();
    const message = this.createMessage('status', {
      status,
      messageCount: session?.messages.length ?? 0,
      ...(session?.provider && { currentProvider: session.provider }),
      ...(session?.model && { currentModel: session.model }),
    });
    await this.broadcast(message);
  }

  /**
   * Handle an incoming message
   */
  async handleMessage(
    clientId: string,
    message: SessionMessage
  ): Promise<SessionMessage | null> {
    // Validate auth if configured
    if (this.config.authToken) {
      // Auth validation would be done in WebSocket upgrade or message header
    }

    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      return handler(clientId, message);
    }

    return this.createMessage('error', {
      code: 'UNKNOWN_MESSAGE_TYPE',
      message: `Unknown message type: ${message.type}`,
    });
  }

  /**
   * Create a session message
   */
  createMessage<T extends SessionPayload>(
    type: SessionMessageType,
    payload: T
  ): SessionMessage {
    return {
      type,
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date().toISOString(),
      payload,
    };
  }

  /**
   * Update client activity timestamp
   */
  private updateClientActivity(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastActivity = new Date();
    }
  }

  /**
   * Get connected clients
   */
  getConnectedClients(): ConnectedClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Check if server is running
   */
  isServerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get server configuration
   */
  getConfig(): SessionServerConfig {
    return { ...this.config };
  }

  /**
   * Get server port
   */
  getPort(): number {
    return this.config.port;
  }

  /**
   * Get server host
   */
  getHost(): string {
    return this.config.host ?? '127.0.0.1';
  }

  /**
   * Get server URL
   */
  getUrl(): string {
    return `http://${this.getHost()}:${this.getPort()}`;
  }
}

/**
 * Create a session server instance
 */
export function createSessionServer(config: SessionServerConfig): SessionServer {
  return new SessionServer(config);
}
