# fosscode Architecture Documentation

## Overview

fosscode is a lightweight, extensible command-line application providing a text user interface (TUI) for performing code agent interactions with Large Language Models (LLMs). The architecture follows a modular design pattern with clear separation of concerns.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI Layer                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ index.ts    │ │ binary.ts   │ │ Commands    │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ ChatCommand │ │ ConfigMgmt  │ │ UI (React)  │          │
│  │             │ │             │ │             │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ Provider    │ │ Tool        │ │ MCP         │          │
│  │ Manager     │ │ Registry    │ │ Manager     │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Data Layer                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ Config      │ │ Chat        │ │ Model       │          │
│  │ Storage     │ │ Logger      │ │ Cache       │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Entry Points

#### Interactive Mode (`src/index.ts`)

- **Purpose**: Full-featured development and interactive use
- **Features**:
  - Text User Interface (TUI) using Ink/React
  - Interactive chat sessions
  - Real-time configuration
  - Messaging platform support
- **Runtime**: Node.js/Bun

#### Binary Mode (`src/binary.ts`)

- **Purpose**: Lightweight binary for CI/CD and automation
- **Features**:
  - Non-interactive mode only
  - Minimal dependencies
  - Cancellation support (Escape key)
  - Message queuing
- **Runtime**: Compiled binary

### 2. Command System (`src/commands/`)

#### Command Pattern Implementation

All commands inherit from a base command pattern and provide:

- Consistent error handling
- Configuration validation
- Provider initialization
- Logging integration

#### Core Commands

- **ChatCommand**: Primary interaction handler
- **AuthCommand**: Authentication management
- **ConfigCommand**: Configuration CRUD operations
- **ProvidersCommand**: Provider listing and information
- **ModelsCommand**: Model discovery and caching
- **MCPCommand**: MCP server management
- **ThemesCommand**: UI theme management

### 3. Provider System (`src/providers/`)

#### Provider Architecture

```
ProviderManager
├── OpenAIProvider
├── GrokProvider
├── LMStudioProvider
├── MCPProvider
├── OpenRouterProvider
├── SonicFreeProvider
├── AnthropicProvider
└── MockProvider (test only)
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

#### Provider Features

- **Unified Interface**: All providers implement the same interface
- **Configuration Validation**: Each provider validates its specific requirements
- **Model Caching**: Automatic caching of available models
- **Error Handling**: Consistent error propagation and handling
- **Cancellation Support**: Request cancellation via CancellationManager

### 4. Tool System (`src/tools/`)

#### Tool Registry Architecture

```
ToolRegistry (Singleton)
├── BashTool
├── EditTool
├── GrepTool
├── ListTool
├── ReadTool
├── WebFetchTool
├── WriteTool
├── TodoTool
└── DuckDuckGoTool
```

#### Tool Interface

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute(params: Record<string, any>): Promise<ToolResult>;
}
```

#### Tool Features

- **Dynamic Registration**: Tools can be registered at runtime
- **Parameter Validation**: Automatic parameter validation
- **Security Management**: SecurityManager for safe file operations
- **Result Standardization**: Consistent result format

### 5. MCP Integration (`src/mcp/`)

#### MCP Architecture

```
MCPManager
├── MCPConfigManager    (Configuration)
├── MCPConnectionManager (WebSocket/Stdio)
├── MCPProtocolHandler  (Protocol compliance)
└── MCPToolManager     (Tool discovery)
```

#### MCP Features

- **Protocol Compliance**: Full Model Context Protocol support
- **Multiple Transports**: WebSocket and stdio support
- **Tool Discovery**: Automatic tool registration from MCP servers
- **Server Management**: Enable/disable specific servers
- **Error Recovery**: Automatic reconnection and error handling

### 6. Configuration Management (`src/config/`)

#### Configuration Stack

```
ConfigManager
├── ConfigDefaults     (Default values)
├── ConfigMigration    (Legacy support)
├── ConfigValidator    (Validation)
└── ModelCacheManager  (Model caching)
```

#### Configuration Features

- **XDG Compliance**: Uses `~/.config/fosscode/` directory
- **Migration Support**: Automatic migration from legacy locations
- **Validation**: Schema validation and security checks
- **Nested Key Support**: Dot notation for nested properties
- **Model Caching**: TTL-based model caching per provider

### 7. User Interface (`src/ui/`)

#### React/Ink Components

```
App (Root)
├── AppHeader
├── MessageList
├── MessageInput
├── AppFooter
└── Components/
    ├── FileSearch
    ├── AttachedFilesIndicator
    └── LoadingIndicator
```

#### UI Features

- **Real-time Rendering**: Live chat interface
- **Theme Support**: Dark/light themes
- **File Operations**: Drag-and-drop file attachment
- **Command History**: Input history with arrow keys
- **Loading States**: Visual feedback for operations

## Data Flow

### Message Flow

```
1. User Input (CLI/TUI)
   ↓
2. Command Processing
   ↓
3. Provider Selection & Validation
   ↓
4. Message Formatting & Tool Context
   ↓
5. Provider API Call
   ↓
6. Response Processing & Tool Execution
   ↓
7. Result Display (Console/TUI)
   ↓
8. Logging & Caching
```

### Configuration Flow

```
1. Application Start
   ↓
2. Load Config (with migration)
   ↓
3. Validate Provider Configs
   ↓
4. Initialize Selected Provider
   ↓
5. Cache Models (if needed)
   ↓
6. Ready for User Interaction
```

## Key Design Patterns

### 1. Command Pattern

- All CLI commands implement a consistent interface
- Centralized command registration and routing
- Shared error handling and logging

### 2. Factory Pattern

- ProviderManager creates provider instances
- Dynamic provider registration
- Configuration-driven instantiation

### 3. Registry Pattern

- ToolRegistry for managing available tools
- Dynamic tool registration and discovery
- Centralized tool lifecycle management

### 4. Observer Pattern

- Configuration change notifications
- UI state management with React hooks
- Event-driven MCP server communication

### 5. Strategy Pattern

- Different providers implement the same interface
- Runtime provider selection
- Pluggable authentication strategies

## Performance Considerations

### 1. Binary Size Optimization

- External dependency optimization
- Tree-shaking for unused code
- Conditional feature loading

### 2. Memory Management

- Conversation history limits
- Model cache TTL management
- Lazy loading of heavy components

### 3. Network Optimization

- Request caching (models, responses)
- Connection pooling for providers
- Timeout management

### 4. Startup Performance

- Lazy provider initialization
- Deferred tool registration
- Configuration caching

## Security Architecture

### 1. Input Validation

- Command parameter sanitization
- Configuration key validation
- File path sanitization

### 2. API Key Management

- Secure storage in configuration files
- Environment variable override support
- No logging of sensitive data

### 3. File System Security

- Path traversal protection
- Permission checking before file operations
- Sandboxed tool execution

### 4. Network Security

- TLS for all external communications
- Certificate validation
- Request/response size limits

## Extensibility Points

### 1. Custom Providers

- Implement `LLMProvider` interface
- Register in `ProviderManager`
- Add configuration schema

### 2. Custom Tools

- Implement `Tool` interface
- Register with `ToolRegistry`
- Define parameter schema

### 3. MCP Servers

- Standard Model Context Protocol
- Dynamic discovery and registration
- Tool and prompt capabilities

### 4. Messaging Platforms

- Implement `MessagingPlatform` interface
- Register with `MessagingPlatformManager`
- Handle platform-specific authentication

## Deployment Modes

### 1. Development Mode

```bash
bun run dev  # Hot reload with full features
```

### 2. Production Mode

```bash
bun run build && bun run start  # Optimized build
```

### 3. Binary Mode

```bash
bun run build:exe  # Standalone executable
```

### 4. Docker Mode

```bash
docker build -t fosscode .  # Containerized deployment
```

## Testing Strategy

### 1. Unit Tests

- Individual component testing
- Mock provider for testing
- Configuration validation testing

### 2. Integration Tests

- End-to-end command testing
- Provider integration testing
- MCP server communication testing

### 3. Performance Tests

- Binary size monitoring
- Startup time measurement
- Memory usage profiling

## Monitoring and Observability

### 1. Logging

- Structured logging with levels
- Chat history persistence
- Debug mode for troubleshooting

### 2. Metrics

- Response times
- Error rates
- Resource usage

### 3. Health Checks

- Provider connectivity
- Configuration validation
- MCP server status

## Future Architecture Considerations

### 1. Plugin System

- Dynamic plugin loading
- Plugin marketplace
- Sandboxed plugin execution

### 2. Distributed Mode

- Multi-instance coordination
- Shared configuration
- Load balancing

### 3. Enterprise Features

- RBAC integration
- Audit logging
- Compliance features

### 4. Performance Enhancements

- Response streaming
- Background processing
- Predictive caching
