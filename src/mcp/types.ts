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
