# fosscode API Design Documentation

## Overview

fosscode provides multiple API layers for different use cases:

1. **CLI API**: Command-line interface for end users
2. **Internal API**: TypeScript interfaces for extensions
3. **MCP Protocol**: Model Context Protocol for tool integration
4. **Provider API**: LLM provider abstraction layer

## CLI API

### Command Structure

```bash
fosscode <command> [subcommand] [options] [arguments]
```

### Core Commands

#### `chat` - Interactive Chat

**Basic Usage:**

```bash
fosscode chat                              # Interactive mode
fosscode chat "message" --non-interactive  # Single message
```

**Options:**

```bash
-p, --provider <provider>          # LLM provider (openai, grok, etc.)
-m, --model <model>               # Specific model to use
-n, --non-interactive            # Non-interactive mode
-v, --verbose                    # Enable verbose output
--messaging-platform <platform>  # Use messaging platform
--mcp <servers>                  # Enable MCP servers
```

**Examples:**

```bash
# Interactive chat with OpenAI
fosscode chat --provider openai --model gpt-4

# Single message with Grok
fosscode chat "Explain async/await" --provider grok --non-interactive

# Verbose mode with tool details
fosscode chat "List files" --verbose --provider sonicfree

# Enable specific MCP servers
fosscode chat --provider mcp --mcp "playwright,context7"

# Messaging platform mode
fosscode chat --messaging-platform telegram --provider openai
```

#### `auth` - Authentication Management

**Usage:**

```bash
fosscode auth login <provider>
```

**Supported Providers:**

```bash
fosscode auth login openai      # OpenAI API key
fosscode auth login grok        # Grok (xAI) API key
fosscode auth login lmstudio    # LMStudio local server
fosscode auth login openrouter  # OpenRouter API key
fosscode auth login mcp         # MCP server configuration
```

**Interactive Flow:**

1. Prompt for API key/configuration
2. Validate credentials
3. Store securely in config
4. Confirm successful authentication

#### `config` - Configuration Management

**Usage:**

```bash
fosscode config set <key> <value>
```

**Configuration Keys:**

```bash
# Provider settings
fosscode config set providers.openai.apiKey "sk-..."
fosscode config set providers.openai.model "gpt-4"
fosscode config set providers.openai.timeout 30000

# Global settings
fosscode config set defaultProvider openai
fosscode config set defaultModel gpt-3.5-turbo
fosscode config set theme dark

# MCP settings
fosscode config set providers.mcp.mcpServerCommand "npx"
fosscode config set providers.mcp.mcpServerArgs '["@playwright/mcp@latest"]'
```

#### `providers` - Provider Information

**Usage:**

```bash
fosscode providers
```

**Output Format:**

```
Available LLM Providers:
✓ openai     - OpenAI GPT models (configured)
✓ grok       - xAI Grok models (configured)
× lmstudio   - Local LMStudio server (not configured)
× openrouter - OpenRouter proxy (not configured)
✓ sonicfree  - Free Sonic API (no auth required)
✓ mcp        - Model Context Protocol (configured)
```

#### `models` - Model Discovery

**Usage:**

```bash
fosscode models [provider]           # List models for provider
fosscode models --provider openai   # Alternative syntax
```

**Output Format:**

```
OpenAI Models:
• gpt-4-turbo-preview
• gpt-4
• gpt-3.5-turbo
• gpt-3.5-turbo-16k

Grok Models:
• grok-beta
• grok-vision-beta
```

#### `themes` - Theme Management

**Usage:**

```bash
fosscode themes           # List available themes
fosscode themes dark      # Set theme
fosscode themes light     # Set theme
```

#### `mcp` - MCP Server Management

**Usage:**

```bash
fosscode mcp list                    # List available servers
fosscode mcp enable playwright       # Enable specific server
fosscode mcp disable context7       # Disable server
fosscode mcp status                  # Show server status
```

## Internal TypeScript API

### Core Interfaces

#### Message Interface

```typescript
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}
```

#### Provider Interface

```typescript
interface LLMProvider {
  sendMessage(
    messages: Message[],
    config: LLMConfig,
    mode?: 'code' | 'thinking'
  ): Promise<ProviderResponse>;

  listModels(config: LLMConfig): Promise<string[]>;
  validateConfig(config: LLMConfig): Promise<boolean>;
}
```

#### Tool Interface

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute(params: Record<string, any>): Promise<ToolResult>;
}

interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  required: boolean;
  defaultValue?: any;
}

interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}
```

#### Configuration Interface

```typescript
interface AppConfig {
  defaultProvider: ProviderType;
  defaultModel: string;
  maxConversations: number;
  theme: 'dark' | 'light';
  providers: Record<ProviderType, LLMConfig>;
  cachedModels: Record<ProviderType, CachedModels>;
  messagingPlatforms?: Record<MessagingPlatformType, MessagingPlatformConfig>;
}

interface LLMConfig {
  apiKey?: string;
  baseURL?: string;
  organization?: string;
  timeout?: number;
  maxRetries?: number;
  model?: string;
  verbose?: boolean;
  // MCP-specific
  mcpServerCommand?: string;
  mcpServerArgs?: string[];
  mcpServerUrl?: string;
}
```

### Service Layer APIs

#### ConfigManager API

```typescript
class ConfigManager {
  // Configuration CRUD
  async loadConfig(): Promise<void>;
  async saveConfig(): Promise<void>;
  async setConfig(key: string, value: unknown): Promise<void>;
  getConfig(): AppConfig;

  // Provider management
  getProviderConfig(provider: ProviderType): LLMConfig;
  async setProviderConfig(provider: ProviderType, config: Partial<LLMConfig>): Promise<void>;

  // Model caching
  async getCachedModels(provider: ProviderType): Promise<string[] | null>;
  async setCachedModels(provider: ProviderType, models: string[]): Promise<void>;
  async clearModelCache(provider?: ProviderType): Promise<void>;

  // Validation
  async validateConfig(): Promise<void>;
  async validateProvider(provider: ProviderType): Promise<void>;
}
```

#### ProviderManager API

```typescript
class ProviderManager {
  // Provider operations
  async initializeProvider(providerType: ProviderType): Promise<void>;
  async sendMessage(
    providerType: ProviderType,
    messages: Message[],
    model?: string,
    verbose?: boolean,
    mode?: 'code' | 'thinking'
  ): Promise<ProviderResponse>;

  // Model operations
  async listModels(providerType: ProviderType): Promise<string[]>;
  getAvailableProviders(): ProviderType[];

  // Health checks
  async testConnection(providerType: ProviderType): Promise<boolean>;
}
```

#### ToolRegistry API

```typescript
class ToolRegistry {
  // Tool management
  register(tool: Tool): void;
  getTool(name: string): Tool | undefined;
  listTools(): Tool[];
  unregister(name: string): boolean;

  // Utility methods
  hasTool(name: string): boolean;
  getToolCount(): number;
  clear(): void;
}
```

### Custom Provider Development

#### Provider Implementation Template

```typescript
import { LLMProvider, Message, LLMConfig, ProviderResponse } from '../types/index.js';

export class CustomProvider implements LLMProvider {
  async sendMessage(
    messages: Message[],
    config: LLMConfig,
    mode?: 'code' | 'thinking'
  ): Promise<ProviderResponse> {
    // Implementation
  }

  async listModels(config: LLMConfig): Promise<string[]> {
    // Implementation
  }

  async validateConfig(config: LLMConfig): Promise<boolean> {
    // Implementation
  }
}
```

#### Provider Registration

```typescript
// In ProviderManager constructor
this.providers.set('custom', new CustomProvider());
```

### Custom Tool Development

#### Tool Implementation Template

```typescript
import { Tool, ToolParameter, ToolResult } from '../types/index.js';

export class CustomTool implements Tool {
  name = 'custom-tool';
  description = 'Description of custom tool functionality';

  parameters: ToolParameter[] = [
    {
      name: 'input',
      type: 'string',
      description: 'Input parameter description',
      required: true,
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      // Tool logic here
      return {
        success: true,
        data: result,
        metadata: {
          /* additional info */
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
```

#### Tool Registration

```typescript
import { toolRegistry } from '../tools/ToolRegistry.js';
import { CustomTool } from './CustomTool.js';

toolRegistry.register(new CustomTool());
```

## MCP Protocol API

### Tool Definition Format

```json
{
  "name": "tool_name",
  "description": "Tool description",
  "inputSchema": {
    "type": "object",
    "properties": {
      "parameter": {
        "type": "string",
        "description": "Parameter description"
      }
    },
    "required": ["parameter"]
  }
}
```

### Tool Execution Format

```json
{
  "method": "tools/call",
  "params": {
    "name": "tool_name",
    "arguments": {
      "parameter": "value"
    }
  }
}
```

### Server Capability Declaration

```json
{
  "capabilities": {
    "tools": {
      "listChanged": true
    },
    "prompts": {
      "listChanged": true
    },
    "resources": {
      "subscribe": false,
      "listChanged": false
    }
  }
}
```

## Error Handling

### Error Response Format

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}
```

### Common Error Codes

```typescript
enum ErrorCodes {
  INVALID_CONFIG = 'INVALID_CONFIG',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  TOOL_EXECUTION_ERROR = 'TOOL_EXECUTION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MCP_CONNECTION_ERROR = 'MCP_CONNECTION_ERROR',
}
```

### Error Handling Examples

```typescript
try {
  const response = await providerManager.sendMessage(/* ... */);
} catch (error) {
  if (error.code === 'AUTHENTICATION_ERROR') {
    console.error('Please check your API key configuration');
  } else if (error.code === 'NETWORK_ERROR') {
    console.error('Network connection failed, please try again');
  } else {
    console.error('An unexpected error occurred:', error.message);
  }
}
```

## Response Formats

### Provider Response

```typescript
interface ProviderResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'error';
}
```

### Tool Execution Response

```typescript
interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    executionTime?: number;
    resourcesUsed?: string[];
    [key: string]: any;
  };
}
```

### Model List Response

```typescript
interface ModelListResponse {
  models: string[];
  cached: boolean;
  lastUpdated: Date;
}
```

## Rate Limiting and Throttling

### Provider Rate Limits

```typescript
interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  concurrent: number;
}

// Provider-specific limits
const rateLimits: Record<ProviderType, RateLimitConfig> = {
  openai: { requestsPerMinute: 60, requestsPerHour: 3600, concurrent: 10 },
  grok: { requestsPerMinute: 100, requestsPerHour: 6000, concurrent: 5 },
};
```

### Retry Logic

```typescript
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}
```

## Authentication Flow

### OAuth 2.0 Flow (Future)

```typescript
interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}

interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}
```

### API Key Flow

```typescript
interface ApiKeyConfig {
  apiKey: string;
  organization?: string;
  project?: string;
}
```

## Caching Strategy

### Model Cache

```typescript
interface CachedModels {
  models: string[];
  lastUpdated: Date;
  expiresAt: Date;
}

// TTL: 24 hours for model lists
const MODEL_CACHE_TTL = 24 * 60 * 60 * 1000;
```

### Response Cache (Future)

```typescript
interface CachedResponse {
  messages: Message[];
  response: ProviderResponse;
  timestamp: Date;
  expiresAt: Date;
}
```

## WebSocket API (MCP Servers)

### Connection Management

```typescript
interface MCPConnection {
  id: string;
  transport: 'websocket' | 'stdio';
  url?: string;
  command?: string;
  args?: string[];
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
}
```

### Message Protocol

```typescript
interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}
```

## Performance Monitoring

### Metrics Collection

```typescript
interface PerformanceMetrics {
  responseTime: number;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  memoryUsage: number;
  toolExecutionTime: number;
}
```

### Health Check Endpoints

```typescript
interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    providers: Record<ProviderType, boolean>;
    mcpServers: Record<string, boolean>;
    configuration: boolean;
  };
  timestamp: Date;
}
```
