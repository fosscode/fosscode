/**
 * MCP Server Configuration
 */
export interface MCPServerConfig {
  name: string;
  description?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  timeout?: number;
  enabled?: boolean;
  /** Health check interval in milliseconds (default: 30000) */
  healthCheckInterval?: number;
  /** Auto-restart on failure (default: true) */
  autoRestart?: boolean;
  /** Maximum restart attempts (default: 3) */
  maxRestartAttempts?: number;
  /** Permissions for this server's tools (supports wildcards) */
  permissions?: string[];
}

/**
 * MCP Server Health Status
 */
export interface MCPServerHealth {
  serverName: string;
  status: 'healthy' | 'unhealthy' | 'unknown' | 'restarting';
  lastCheck: Date;
  lastError?: string;
  restartCount: number;
  uptime: number;
}

/**
 * MCP Server Template
 */
export interface MCPServerTemplate {
  id: string;
  name: string;
  description: string;
  category: 'filesystem' | 'git' | 'database' | 'api' | 'utility' | 'custom';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  requiredEnvVars?: string[];
  optionalEnvVars?: string[];
  documentation?: string;
  permissions?: string[];
}

/**
 * MCP Permission Rule
 */
export interface MCPPermissionRule {
  pattern: string;
  allowed: boolean;
}

/**
 * MCP Tool Documentation
 */
export interface MCPToolDocumentation {
  toolName: string;
  serverName: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
    defaultValue?: any;
  }>;
  examples?: Array<{
    description: string;
    input: Record<string, any>;
    output?: string;
  }>;
  notes?: string[];
}

/**
 * MCP Protocol Message Types
 */
export interface MCPRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

/**
 * MCP Tool Definition
 */
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

/**
 * MCP Tool Call
 */
export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

/**
 * MCP Tool Result
 */
export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'audio' | 'resource' | 'resource_link';
    text?: string;
    data?: string;
    mimeType?: string;
    resource?: any;
    uri?: string;
    name?: string;
    description?: string;
    annotations?: {
      audience?: ('user' | 'assistant')[];
      priority?: number;
      lastModified?: string;
    };
  }>;
  isError?: boolean;
  structuredContent?: any;
}
