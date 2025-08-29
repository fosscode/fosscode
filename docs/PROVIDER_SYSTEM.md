# fosscode Provider System Documentation

## Overview

The Provider System is the core abstraction layer that enables fosscode to communicate with multiple Large Language Model (LLM) providers through a unified interface. This system provides provider-agnostic functionality while allowing for provider-specific optimizations and features.

## Architecture

### Provider Hierarchy

```
LLMProvider (Interface)
├── OpenAIProvider
├── GrokProvider
├── LMStudioProvider
├── MCPProvider
├── OpenRouterProvider
├── SonicFreeProvider
├── AnthropicProvider
└── MockProvider (testing)
```

### Core Interface

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

## Provider Manager

### Responsibilities

- **Provider Registration**: Dynamic provider registration and management
- **Configuration Validation**: Ensures provider configurations are valid
- **Request Routing**: Routes requests to appropriate providers
- **Error Handling**: Standardized error handling across providers
- **Caching**: Model list caching with TTL management
- **Cancellation Support**: Request cancellation via CancellationManager

### Implementation

```typescript
export class ProviderManager {
  private providers: Map<ProviderType, LLMProvider>;
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.providers = new Map();

    // Register all available providers
    this.providers.set('openai', new OpenAIProvider());
    this.providers.set('grok', new GrokProvider());
    this.providers.set('lmstudio', new LMStudioProvider());
    this.providers.set('mcp', new MCPProvider());
    this.providers.set('openrouter', new OpenRouterProvider());
    this.providers.set('sonicfree', new SonicFreeProvider());
    this.providers.set('anthropic', new AnthropicProvider());
  }
}
```

## Individual Providers

### OpenAI Provider

**Location**: `src/providers/OpenAIProvider.ts`

#### Features

- **Full OpenAI API Support**: Chat completions, model listing, streaming
- **Tool Integration**: Native function calling support
- **Streaming Support**: Real-time response streaming in verbose mode
- **Organization Support**: Multi-org API key support
- **Robust Error Handling**: Detailed error messages and retry logic

#### Configuration

```json
{
  "apiKey": "sk-...",
  "organization": "org-...",
  "timeout": 30000,
  "maxRetries": 3,
  "model": "gpt-4",
  "verbose": false
}
```

#### Unique Features

- **Streaming in Verbose Mode**: Shows real-time AI response
- **Token Usage Tracking**: Detailed token consumption metrics
- **Tool Call Loop**: Automatic tool execution with conversation continuity
- **Cancellation Support**: Mid-request cancellation handling

#### Implementation Details

```typescript
export class OpenAIProvider implements LLMProvider {
  private client: OpenAI | null = null;

  async sendMessage(
    messages: Message[],
    config: LLMConfig,
    mode?: 'code' | 'thinking'
  ): Promise<ProviderResponse> {
    // System prompt generation
    const systemPrompt = await generateSystemPrompt(
      'openai',
      config.model ?? 'gpt-3.5-turbo',
      mode
    );

    // Tool integration
    const openaiTools = hasAvailableTools() ? getOpenAIToolsFormat(mode) : undefined;

    // Agent loop for tool calling (max 10 iterations)
    for (let iteration = 0; iteration < 10; iteration++) {
      // Streaming vs non-streaming based on verbose mode
      if (config.verbose) {
        // Real-time streaming implementation
      } else {
        // Standard completion request
      }

      // Tool call handling
      if (assistantMessage.tool_calls) {
        const toolResult = await executeToolCalls(assistantMessage.tool_calls, mode);
        // Continue loop for next response
      }
    }
  }
}
```

### Grok Provider

**Location**: `src/providers/GrokProvider.ts`

#### Features

- **xAI API Integration**: Direct integration with x.ai API
- **Multi-Model Fallback**: Automatic fallback through model variants
- **Tool Support**: OpenAI-compatible tool calling
- **Timeout Management**: Request timeout handling

#### Configuration

```json
{
  "apiKey": "xai-...",
  "baseURL": "https://api.x.ai/v1",
  "timeout": 30000,
  "maxRetries": 3,
  "model": "grok-4-0709",
  "verbose": false
}
```

#### Model Fallback Strategy

```typescript
// Prioritized model list for fallback
const modelsToTry = [
  'grok-4-0709', // Latest/primary model
  'sonic-fast-1', // Fast alternative
  'grok-3-fast', // Previous generation
  'grok-2', // Stable fallback
  'grok-beta', // Beta access
  'grok-1', // Original
  'grok', // Generic fallback
];
```

#### Unique Features

- **Intelligent Model Fallback**: Tries multiple model variants automatically
- **Debug Logging**: Detailed model selection logging
- **Timeout Protection**: Request-level timeout handling
- **Error Classification**: Distinguishes between 404 (model not found) and other errors

### LMStudio Provider

**Location**: `src/providers/LMStudioProvider.ts`

#### Features

- **Local Server Integration**: Connect to locally hosted LMStudio
- **Custom Model Support**: Works with any locally loaded model
- **No API Key Required**: Direct server connection
- **Flexible Configuration**: Configurable base URL and timeout

#### Configuration

```json
{
  "baseURL": "http://localhost:1234",
  "timeout": 60000,
  "maxRetries": 2,
  "model": "local-model",
  "verbose": true
}
```

#### Use Cases

- **Privacy-First Development**: Keep all data local
- **Custom Model Testing**: Test specialized or fine-tuned models
- **Offline Development**: Work without internet connectivity
- **Cost-Free Development**: No API costs for development

### MCP Provider

**Location**: `src/providers/MCPProvider.ts`

#### Features

- **Model Context Protocol**: Full MCP specification compliance
- **Tool Discovery**: Automatic tool registration from MCP servers
- **Multi-Transport**: WebSocket and stdio transport support
- **Protocol Abstraction**: High-level interface over MCP complexity

#### Configuration

```json
{
  "mcpServerCommand": "npx",
  "mcpServerArgs": ["@playwright/mcp@latest"],
  "timeout": 30000,
  "verbose": true
}
```

#### Architecture Components

```typescript
export class MCPProvider implements LLMProvider {
  private protocolHandler: MCPProtocolHandler;
  private connectionManager: MCPConnectionManager;
  private toolManager: MCPToolManager;
  private messageParser: MCPMessageParser;
}
```

#### Unique Features

- **Tool-First Design**: Primarily focused on tool execution rather than text generation
- **Dynamic Tool Discovery**: Automatically discovers available tools from MCP server
- **Message Parsing**: Intelligent parsing of user requests to identify tool calls
- **Protocol Compliance**: Full adherence to MCP specification

### SonicFree Provider

**Location**: `src/providers/SonicFreeProvider.ts`

#### Features

- **Free API Access**: No authentication required
- **Rate Limited**: Built-in respect for service limits
- **Development Friendly**: Perfect for testing and development
- **OpenAI Compatible**: Uses OpenAI-compatible API format

#### Configuration

```json
{
  "baseURL": "https://gateway.opencode.ai/v1",
  "timeout": 30000,
  "maxRetries": 3,
  "model": "sonic",
  "verbose": false
}
```

#### Use Cases

- **Quick Testing**: Rapid prototyping without API setup
- **CI/CD Integration**: Automated testing without API costs
- **Learning and Experimentation**: Risk-free experimentation
- **Fallback Provider**: Emergency backup when other providers fail

### OpenRouter Provider

**Location**: `src/providers/OpenRouterProvider.ts`

#### Features

- **Multi-Model Access**: Access to hundreds of models through single API
- **Unified Interface**: Single API key for multiple model providers
- **Cost Optimization**: Pay-per-use pricing across different providers
- **Model Variety**: Access to Anthropic, OpenAI, Google, and other models

#### Configuration

```json
{
  "apiKey": "sk-or-v1-...",
  "baseURL": "https://openrouter.ai/api/v1",
  "timeout": 30000,
  "maxRetries": 3,
  "model": "anthropic/claude-3-haiku",
  "verbose": false
}
```

### Anthropic Provider

**Location**: `src/providers/AnthropicProvider.ts`

#### Features

- **Claude Model Access**: Direct integration with Anthropic's Claude models
- **Constitutional AI**: Built-in safety and helpfulness optimizations
- **Long Context Support**: Support for very long conversations
- **Tool Integration**: Function calling capabilities

#### Configuration

```json
{
  "apiKey": "sk-ant-...",
  "timeout": 30000,
  "maxRetries": 3,
  "model": "claude-3-5-sonnet-20241022",
  "verbose": false
}
```

### Mock Provider (Testing Only)

**Location**: `src/providers/MockProvider.ts`

#### Features

- **Deterministic Responses**: Predictable output for testing
- **Configurable Behavior**: Simulate various scenarios
- **No External Dependencies**: Runs completely offline
- **Performance Testing**: Measure system performance without API latency

#### Configuration

```typescript
// Activated via environment variable
process.env.FOSSCODE_PROVIDER = 'mock';
```

## Provider Configuration System

### Configuration Schema

```typescript
interface LLMConfig {
  // Authentication
  apiKey?: string;
  organization?: string;

  // Connection settings
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;

  // Model settings
  model?: string;
  verbose?: boolean;

  // MCP-specific
  mcpServerCommand?: string;
  mcpServerArgs?: string[];
  mcpServerUrl?: string;
}
```

### Configuration Defaults

```typescript
export class ConfigDefaults {
  static getDefaultModelForProvider(provider: string): string {
    const defaults = {
      openai: 'gpt-3.5-turbo',
      grok: 'grok-4-0709',
      lmstudio: 'local-model',
      mcp: 'mcp-server',
      openrouter: 'anthropic/claude-3-haiku',
      sonicfree: 'sonic',
      anthropic: 'claude-3-5-sonnet-20241022',
    };
    return defaults[provider] || 'default-model';
  }
}
```

### Configuration Validation

Each provider implements custom validation logic:

```typescript
// Example: OpenAI validation
async validateConfig(config: LLMConfig): Promise<boolean> {
  if (!config.apiKey) return false
  if (!config.apiKey.startsWith('sk-')) return false
  if (config.apiKey.length < 20) return false
  return true
}

// Example: Grok validation
async validateConfig(config: LLMConfig): Promise<boolean> {
  if (!config.apiKey) return false
  if (!config.apiKey.startsWith('xai-')) return false
  if (config.apiKey.length < 20) return false
  return true
}
```

## Advanced Features

### Model Caching

```typescript
interface CachedModels {
  models: string[];
  lastUpdated: Date;
  expiresAt: Date;
}

// 24-hour TTL for model cache
const MODEL_CACHE_TTL = 24 * 60 * 60 * 1000;
```

**Cache Flow:**

1. Check for valid cached models
2. Return cache if valid and not expired
3. Fetch from API if cache miss or expired
4. Update cache with new results
5. Fall back to expired cache if API fails

### Tool Integration

All providers support the unified tool system:

```typescript
// Tool format conversion for different providers
const openaiTools = hasAvailableTools() ? getOpenAIToolsFormat(mode) : undefined;

// Tool execution with provider context
const toolResult = await executeToolCalls(assistantMessage.tool_calls, mode);
```

### Request Cancellation

```typescript
// Check for cancellation throughout request lifecycle
if (cancellationManager.shouldCancel()) {
  throw new Error('Request cancelled by user');
}
```

### Streaming Support

```typescript
// OpenAI streaming example
if (config.verbose) {
  const stream = await this.client.chat.completions.create({
    model: config.model ?? 'gpt-3.5-turbo',
    messages: openaiMessages,
    stream: true,
    tools: openaiTools,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (delta?.content) {
      process.stdout.write(delta.content);
    }
  }
}
```

## Error Handling Strategy

### Error Categories

1. **Configuration Errors**: Invalid API keys, missing settings
2. **Network Errors**: Connection failures, timeouts
3. **Provider Errors**: API-specific errors, rate limits
4. **Tool Errors**: Tool execution failures
5. **Cancellation Errors**: User-initiated cancellations

### Error Response Format

```typescript
interface ProviderError extends Error {
  code: string;
  provider: ProviderType;
  details?: Record<string, any>;
}
```

### Retry Logic

```typescript
// Exponential backoff with jitter
const retryConfig = {
  maxRetries: config.maxRetries ?? 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};
```

## Performance Optimization

### Connection Pooling

```typescript
// Reuse HTTP clients across requests
private client: OpenAI | null = null

if (!this.client) {
  this.client = new OpenAI({
    apiKey: config.apiKey,
    timeout: config.timeout ?? 30000,
    maxRetries: config.maxRetries ?? 3
  })
}
```

### Request Optimization

- **Lazy Initialization**: Providers initialized only when needed
- **Model Caching**: Reduce API calls for model discovery
- **Request Deduplication**: Avoid duplicate concurrent requests
- **Timeout Management**: Prevent hanging requests

### Memory Management

- **Connection Cleanup**: Proper cleanup of HTTP clients
- **Cache Size Limits**: Bounded cache to prevent memory leaks
- **Tool Registry Cleanup**: Unregister tools when providers disconnect

## Testing Strategy

### Unit Testing

```typescript
describe('OpenAIProvider', () => {
  it('should validate API key format', async () => {
    const provider = new OpenAIProvider();

    expect(await provider.validateConfig({ apiKey: 'invalid' })).toBe(false);
    expect(await provider.validateConfig({ apiKey: 'sk-validkey123...' })).toBe(true);
  });
});
```

### Integration Testing

```typescript
// Mock provider for consistent testing
if (process.env.FOSSCODE_PROVIDER === 'mock') {
  this.providers.set('mock', new MockProvider());
}
```

### Provider Testing Matrix

| Provider  | Unit Tests | Integration | API Tests | Tool Tests |
| --------- | ---------- | ----------- | --------- | ---------- |
| OpenAI    | ✅         | ✅          | ⚠️\*      | ✅         |
| Grok      | ✅         | ✅          | ⚠️\*      | ✅         |
| LMStudio  | ✅         | ⚠️\*\*      | ✅        | ✅         |
| MCP       | ✅         | ✅          | ✅        | ✅         |
| SonicFree | ✅         | ✅          | ✅        | ✅         |

\*Requires API keys
\*\*Requires local LMStudio instance

## Security Considerations

### API Key Security

- **Storage**: Encrypted storage in configuration files
- **Transmission**: HTTPS-only API communication
- **Logging**: API keys never logged or displayed
- **Environment**: Support for environment variable overrides

### Input Validation

```typescript
// Prevent injection attacks
private sanitizeInput(content: string): string {
  return content.replace(/[<>]/g, '')
}

// Validate configuration keys
private isPrototypePollutingKey(key: string): boolean {
  const dangerousKeys = ['__proto__', 'constructor', 'prototype']
  return dangerousKeys.includes(key)
}
```

### Network Security

- **Certificate Validation**: Strict TLS certificate checking
- **Timeout Limits**: Prevent resource exhaustion
- **Rate Limiting**: Respect provider rate limits
- **Request Size Limits**: Prevent oversized requests

## Extending the Provider System

### Adding a New Provider

1. **Implement LLMProvider Interface**

```typescript
export class NewProvider implements LLMProvider {
  async validateConfig(config: LLMConfig): Promise<boolean> {
    // Validation logic
  }

  async sendMessage(
    messages: Message[],
    config: LLMConfig,
    mode?: 'code' | 'thinking'
  ): Promise<ProviderResponse> {
    // Implementation
  }

  async listModels(config: LLMConfig): Promise<string[]> {
    // Model discovery
  }
}
```

2. **Register in ProviderManager**

```typescript
// Add to providers map
this.providers.set('newprovider', new NewProvider());
```

3. **Add to Types**

```typescript
export type ProviderType =
  | 'openai'
  | 'grok'
  | 'lmstudio'
  | 'mcp'
  | 'openrouter'
  | 'sonicfree'
  | 'anthropic'
  | 'newprovider' // Add here
  | 'mock';
```

4. **Update Configuration Defaults**

```typescript
static getDefaultModelForProvider(provider: string): string {
  const defaults = {
    // ... existing providers
    newprovider: 'default-new-model'
  }
  return defaults[provider] || 'default-model'
}
```

5. **Add Authentication Command**

```typescript
// In AuthCommand.ts
case 'newprovider':
  // Provider-specific authentication flow
  break
```

### Provider Feature Matrix

| Feature        | Required | Optional | Notes                                  |
| -------------- | -------- | -------- | -------------------------------------- |
| validateConfig | ✅       |          | Must validate provider-specific config |
| sendMessage    | ✅       |          | Core functionality                     |
| listModels     | ✅       |          | Can return static list                 |
| Tool Support   |          | ✅       | Enhances capabilities                  |
| Streaming      |          | ✅       | Better user experience                 |
| Cancellation   |          | ✅       | User experience improvement            |
| Caching        |          | ✅       | Performance optimization               |

## Future Enhancements

### Planned Features

1. **Provider Health Monitoring**
   - Real-time provider status
   - Automatic failover
   - Performance metrics

2. **Smart Provider Selection**
   - Cost-aware routing
   - Performance-based selection
   - Feature-based matching

3. **Provider Plugins**
   - Dynamic provider loading
   - Third-party provider support
   - Plugin marketplace

4. **Advanced Caching**
   - Response caching
   - Semantic similarity caching
   - Distributed caching

5. **Load Balancing**
   - Multi-provider load distribution
   - Rate limit management
   - Geographic routing

### Research Areas

- **Provider Benchmarking**: Automated performance comparison
- **Cost Optimization**: Intelligent provider selection based on cost
- **Quality Metrics**: Response quality assessment and routing
- **Latency Optimization**: Geographic provider selection
- **Reliability Improvements**: Circuit breakers and fallback chains
