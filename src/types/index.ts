export type ProviderType =
  | 'openai'
  | 'grok'
  | 'lmstudio'
  | 'openrouter'
  | 'sonicfree'
  | 'mcp'
  | 'anthropic';

export interface MCPServerConfig {
  name: string;
  mcpServerCommand?: string;
  mcpServerArgs?: string[];
  mcpServerUrl?: string;
  timeout?: number;
  verbose?: boolean;
  enabled?: boolean;
}

export interface LLMConfig {
  apiKey?: string;
  baseURL?: string;
  organization?: string;
  timeout?: number;
  maxRetries?: number;
  model?: string;
  verbose?: boolean;
  // MCP-specific config (legacy single server support)
  mcpServerCommand?: string;
  mcpServerArgs?: string[];
  mcpServerUrl?: string;
  // Multiple MCP servers support
  mcpServers?: Record<string, MCPServerConfig>;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  messages: Message[];
  provider: ProviderType;
  model: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderResponse {
  content: string;
  usage?:
    | {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      }
    | undefined;
  finishReason: 'stop' | 'length' | 'error';
}

export interface CachedModels {
  models: string[];
  lastUpdated: Date;
  expiresAt: Date;
}

export interface AppConfig {
  defaultProvider: ProviderType;
  defaultModel: string;
  maxConversations: number;
  theme: 'dark' | 'light';
  providers: Record<ProviderType, LLMConfig>;
  cachedModels: Record<ProviderType, CachedModels>;
}

export interface PerformanceMetrics {
  memoryUsage: number;
  startupTime: number;
  responseTime: number;
  bundleSize: number;
}

export interface LLMProvider {
  sendMessage(
    messages: Message[],
    config: LLMConfig,
    mode?: 'code' | 'thinking'
  ): Promise<ProviderResponse>;
  listModels(config: LLMConfig): Promise<string[]>;
  validateConfig(config: LLMConfig): Promise<boolean>;
}

// Tool-related types for agent capabilities
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  required: boolean;
  defaultValue?: any;
}

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute(params: Record<string, any>): Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ToolRegistry {
  register(tool: Tool): void;
  getTool(name: string): Tool | undefined;
  listTools(): Tool[];
  unregister(name: string): boolean;
}

// Message Queue types
export interface QueuedMessage {
  id: string;
  message: string;
  options: {
    provider?: string;
    model?: string;
    verbose?: boolean;
  };
  timestamp: Date;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  response?: string;
  error?: string;
}

export interface MessageQueueState {
  isProcessing: boolean;
  queue: QueuedMessage[];
  currentMessage?: QueuedMessage;
}
