import { PermissionManager } from '../utils/PermissionManager.js';

export type ProviderType =
  | 'openai'
  | 'grok'
  | 'lmstudio'
  | 'openrouter'
  | 'sonicfree'
  | 'mcp'
  | 'anthropic'
  | 'mock';

export type MessagingPlatformType = 'telegram' | 'discord' | 'slack' | 'terminal';

export interface MessagingPlatformMessage {
  id: string;
  content: string;
  userName: string;
  userId: string;
  chatId: string;
  platform: MessagingPlatformType;
  timestamp: Date;
}

export interface MessagingPlatformConfig {
  botToken?: string;
  enabled?: boolean;
  webhookUrl?: string;
}

export interface MessagingPlatformResponse {
  success: boolean;
  content?: string;
  messageId?: string;
  error?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface MessagingPlatform {
  getPlatformType(): MessagingPlatformType;
  initialize(config: MessagingPlatformConfig): Promise<void>;
  sendMessage(chatId: string, message: string): Promise<MessagingPlatformResponse>;
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  isActive(): boolean;
}

export interface LLMConfig {
  apiKey?: string;
  baseURL?: string;
  organization?: string;
  timeout?: number;
  maxRetries?: number;
  model?: string;
  verbose?: boolean;
  // MCP-specific config
  mcpServerCommand?: string;
  mcpServerArgs?: string[];
  mcpServerUrl?: string;
}

export interface MessageImage {
  filePath: string;
  fileName: string;
  mimeType: string;
  base64Data: string;
  sizeBytes: number;
  format: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'summary';
  content: string;
  timestamp: Date;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  images?: MessageImage[];
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
  thinkingBlocks?: string[];
}

export interface CachedModels {
  models: string[];
  lastUpdated: Date;
  expiresAt: Date;
}

export interface AppConfig {
  defaultProvider: ProviderType;
  defaultModel: string;
  lastSelectedProvider?: ProviderType;
  lastSelectedModel?: string;
  maxConversations: number;
  theme: 'dark' | 'light';
  verbose?: boolean;
  providers: Record<ProviderType, LLMConfig>;
  cachedModels: Record<ProviderType, CachedModels>;
  messagingPlatforms?: Record<MessagingPlatformType, { enabled: boolean; botToken?: string }>;
  contextDisplay?: {
    enabled: boolean;
    format: 'percentage' | 'tokens' | 'both';
    showWarnings: boolean;
    warningThreshold: number;
  };
  thinkingDisplay?: {
    enabled: boolean;
    showThinkingBlocks: boolean;
  };
  approvalMode?: {
    enabled: boolean;
    godMode: boolean;
    allowlist: string[];
  };
  approvals?: {
    session: Record<string, 'once' | 'session' | 'always'>;
    persistent: Record<string, 'always'>;
  };
}

export interface PerformanceMetrics {
  memoryUsage: number;
  startupTime: number;
  responseTime: number;
  bundleSize: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface LLMProvider {
  sendMessage(
    messages: Message[],
    config: LLMConfig,
    mode?: 'code' | 'thinking',
    chatLogger?: any,
    permissionManager?: PermissionManager
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

// Background Task types for agent task management
export type BackgroundTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type BackgroundTaskPriority = 'low' | 'normal' | 'high';

export interface BackgroundTaskConfig {
  provider: ProviderType;
  model: string;
  verbose?: boolean;
  timeout?: number;
  maxRetries?: number;
}

export interface BackgroundTaskOutput {
  timestamp: Date;
  type: 'stdout' | 'stderr' | 'progress' | 'result';
  content: string;
}

export interface BackgroundTask {
  id: string;
  name: string;
  description: string;
  status: BackgroundTaskStatus;
  priority: BackgroundTaskPriority;
  config: BackgroundTaskConfig;
  parentTaskId?: string;
  childTaskIds: string[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  output: BackgroundTaskOutput[];
  progress: number;
  result?: any;
  error?: string;
  retryCount: number;
}

export interface SubagentConfig {
  name: string;
  description: string;
  instructions: string;
  provider: ProviderType;
  model: string;
  tools?: string[];
  maxTokens?: number;
  timeout?: number;
}

export interface TaskQueueState {
  isProcessing: boolean;
  maxConcurrent: number;
  runningTasks: BackgroundTask[];
  queuedTasks: BackgroundTask[];
  completedTasks: BackgroundTask[];
}

export interface TaskQueueStats {
  totalQueued: number;
  totalRunning: number;
  totalCompleted: number;
  totalFailed: number;
  isProcessing: boolean;
}

// Re-export skill types
export * from './skills.js';
