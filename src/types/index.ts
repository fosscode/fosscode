export type ProviderType =
  | 'openai'
  | 'grok'
  | 'lmstudio'
  | 'openrouter'
  | 'sonicfree'
  | 'mcp'
  | 'anthropic';

export type MessagingPlatformType = 'telegram' | 'discord' | 'slack' | 'terminal';

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

export interface MessagingPlatformConfig {
  enabled: boolean;
  botToken?: string;
  webhookUrl?: string;
  apiUrl?: string;
  timeout?: number;
  maxRetries?: number;
  verbose?: boolean;
}

export interface AppConfig {
  defaultProvider: ProviderType;
  defaultModel: string;
  maxConversations: number;
  theme: 'dark' | 'light';
  providers: Record<ProviderType, LLMConfig>;
  cachedModels: Record<ProviderType, CachedModels>;
  messagingPlatforms: Record<MessagingPlatformType, MessagingPlatformConfig>;
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

// Messaging Platform types
export interface MessagingPlatformMessage {
  id: string;
  content: string;
  userId: string;
  userName: string;
  chatId: string;
  timestamp: Date;
  platform: MessagingPlatformType;
}

export interface MessagingPlatformResponse {
  content: string;
  success: boolean;
  error?: string;
}

export interface MessagingPlatform {
  initialize(config: MessagingPlatformConfig): Promise<void>;
  sendMessage(chatId: string, message: string): Promise<MessagingPlatformResponse>;
  listenForMessages(callback: (message: MessagingPlatformMessage) => Promise<void>): Promise<void>;
  stopListening(): Promise<void>;
  validateConfig(config: MessagingPlatformConfig): Promise<boolean>;
  getPlatformType(): MessagingPlatformType;
}
