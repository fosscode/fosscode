# fosscode MCP Integration Documentation

## Overview

Model Context Protocol (MCP) integration enables fosscode to connect with external MCP servers, dynamically discovering and registering tools for enhanced capabilities. This system provides a standardized way to extend fosscode's functionality through external services and applications.

## Architecture

### MCP System Components

```
MCPManager
├── MCPConnectionManager  (Server connections)
├── MCPToolManager       (Tool discovery & registration)
├── MCPConfigManager     (Configuration management)
└── MCPProtocolHandler   (Protocol compliance)
```

### Data Flow

```
1. Configuration Loading
   ↓
2. Server Connection (stdio/websocket)
   ↓
3. Protocol Handshake (initialize/initialized)
   ↓
4. Tool Discovery (tools/list)
   ↓
5. Tool Registration (fosscode ToolRegistry)
   ↓
6. Tool Execution (tools/call)
   ↓
7. Result Processing & Display
```

## Core Components

### MCPManager

**Location**: `src/mcp/MCPManager.ts`

#### Purpose

High-level orchestration of MCP system operations including server lifecycle management.

#### Features

- **Server Management**: Enable/disable MCP servers
- **Bulk Operations**: Enable multiple servers simultaneously
- **Status Tracking**: Monitor server connection states
- **Error Handling**: Graceful error management with detailed messages
- **Cleanup**: Proper resource cleanup on shutdown

#### Key Methods

```typescript
export class MCPManager {
  // Initialize MCP system
  async initialize(): Promise<void>;

  // Server management
  async enableServer(serverName: string): Promise<void>;
  async disableServer(serverName: string): Promise<void>;
  async enableServers(serverNames: string[]): Promise<void>;
  async disableAllServers(): Promise<void>;

  // Server information
  getAvailableServers(): MCPServerConfig[];
  isServerEnabled(serverName: string): boolean;
  getServerStatus(): Array<{ name: string; enabled: boolean; config: MCPServerConfig }>;

  // Cleanup
  async cleanup(): Promise<void>;
}
```

#### Usage Example

```typescript
const mcpManager = new MCPManager();
await mcpManager.initialize();

// Enable specific servers
await mcpManager.enableServers(['playwright', 'context7']);

// Check status
const status = mcpManager.getServerStatus();
console.log(status);

// Cleanup on exit
await mcpManager.cleanup();
```

### MCPConnectionManager

**Location**: `src/mcp/MCPConnectionManager.ts`

#### Purpose

Manages network connections and protocol-level communication with MCP servers.

#### Features

- **Process Management**: Spawn and manage MCP server processes
- **Protocol Handshake**: Handle MCP initialization sequence
- **Connection Pooling**: Reuse connections across operations
- **Health Monitoring**: Track connection status
- **Error Recovery**: Automatic cleanup on connection failures

#### Connection Flow

```typescript
// 1. Spawn server process
const childProcess = spawn(config.command, config.args ?? [], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, ...config.env },
});

// 2. Create protocol handler
const protocolHandler = new MCPProtocolHandler();
protocolHandler.setChildProcess(childProcess);

// 3. Perform MCP handshake
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
    clientInfo: {
      name: 'fosscode',
      version: '0.0.42',
    },
  },
};

await protocolHandler.sendRequest(initRequest);

// 4. Send initialized notification
protocolHandler.sendNotification({
  jsonrpc: '2.0',
  method: 'notifications/initialized',
});
```

#### Connection Types

##### Stdio Connection (Default)

```typescript
const childProcess = spawn(command, args, {
  stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr
});

// Communication via stdin/stdout JSON-RPC
```

##### WebSocket Connection (Future)

```typescript
// Will support WebSocket transport for remote servers
const ws = new WebSocket(config.url);
ws.on('message', handleMessage);
```

### MCPToolManager

**Location**: `src/mcp/MCPToolManager.ts`

#### Purpose

Discovers, converts, and registers MCP tools within fosscode's tool system.

#### Features

- **Tool Discovery**: Query MCP servers for available tools
- **Schema Conversion**: Convert MCP JSON Schema to fosscode ToolParameter format
- **Dynamic Registration**: Register/unregister tools dynamically
- **Tool Execution**: Proxy tool calls to appropriate MCP servers
- **Result Formatting**: Format MCP results for display

#### Tool Discovery Process

```typescript
// 1. Query server for tools
const toolsRequest = {
  jsonrpc: '2.0',
  id: nextId(),
  method: 'tools/list',
  params: {},
};

const response = await protocolHandler.sendRequest(toolsRequest);
const mcpTools: MCPTool[] = response.tools || [];

// 2. Convert MCP tools to fosscode format
for (const mcpTool of mcpTools) {
  const fosscodeTool: Tool = {
    name: `mcp_${serverName}_${mcpTool.name}`,
    description: mcpTool.description ?? `MCP tool: ${mcpTool.name}`,
    parameters: convertMCPParameters(mcpTool),
    execute: async params => {
      // Proxy to MCP server
      return await executeMCPTool(serverName, mcpTool.name, params);
    },
  };

  // 3. Register with fosscode tool registry
  toolRegistry.register(fosscodeTool);
}
```

#### Parameter Conversion

```typescript
private convertMCPParameters(mcpTool: MCPTool): ToolParameter[] {
  const parameters: ToolParameter[] = []

  if (mcpTool.inputSchema.properties) {
    for (const [paramName, paramSchema] of Object.entries(mcpTool.inputSchema.properties)) {
      const isRequired = mcpTool.inputSchema.required?.includes(paramName) ?? false

      // Convert JSON Schema type to fosscode type
      let paramType: 'string' | 'number' | 'boolean' | 'array' = 'string'
      if (typeof paramSchema === 'object' && 'type' in paramSchema) {
        switch (paramSchema.type) {
          case 'number':
          case 'integer':
            paramType = 'number'
            break
          case 'boolean':
            paramType = 'boolean'
            break
          case 'array':
            paramType = 'array'
            break
          default:
            paramType = 'string'
        }
      }

      parameters.push({
        name: paramName,
        type: paramType,
        description: paramSchema.description || `Parameter ${paramName}`,
        required: isRequired
      })
    }
  }

  return parameters
}
```

#### Tool Execution Proxy

```typescript
async execute(params: Record<string, any>): Promise<ToolResult> {
  try {
    const protocolHandler = connectionManager.getProtocolHandler(serverName)
    if (!protocolHandler) {
      throw new Error(`Server '${serverName}' is not connected`)
    }

    // Make MCP tool call
    const callRequest = {
      jsonrpc: '2.0',
      id: protocolHandler.getNextRequestId(),
      method: 'tools/call',
      params: {
        name: mcpTool.name,
        arguments: params
      }
    }

    const result = await protocolHandler.sendRequest(callRequest)

    return {
      success: !result.isError,
      data: result.content,
      error: result.isError ? result.content?.[0]?.text || 'Unknown error' : undefined
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
```

### MCPProtocolHandler

**Location**: `src/mcp/MCPProtocolHandler.ts`

#### Purpose

Low-level JSON-RPC protocol implementation for MCP communication.

#### Features

- **JSON-RPC 2.0**: Full specification compliance
- **Request/Response**: Structured request/response handling
- **Notifications**: One-way notification support
- **Message Queuing**: Handle concurrent requests
- **Error Handling**: Protocol-level error management

#### Protocol Implementation

```typescript
export class MCPProtocolHandler {
  private childProcess?: ChildProcess;
  private requestId = 0;
  private pendingRequests = new Map<
    string | number,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();

  setChildProcess(process: ChildProcess): void {
    this.childProcess = process;

    // Handle messages from server
    process.stdout?.on('data', data => {
      const messages = this.parseMessages(data.toString());
      messages.forEach(message => this.handleMessage(message));
    });
  }

  async sendRequest(request: MCPRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Request ${request.id} timed out`));
      }, 30000);

      // Store pending request
      this.pendingRequests.set(request.id, { resolve, reject, timeout });

      // Send request
      this.sendMessage(request);
    });
  }

  sendNotification(notification: MCPNotification): void {
    this.sendMessage(notification);
  }

  private sendMessage(message: any): void {
    if (!this.childProcess?.stdin) {
      throw new Error('No active connection');
    }

    const messageText = JSON.stringify(message) + '\n';
    this.childProcess.stdin.write(messageText);
  }

  private handleMessage(message: any): void {
    if ('id' in message && this.pendingRequests.has(message.id)) {
      // Response to our request
      const pending = this.pendingRequests.get(message.id)!;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.id);

      if ('error' in message) {
        pending.reject(new Error(`MCP Error: ${message.error.message}`));
      } else {
        pending.resolve(message.result);
      }
    } else if ('method' in message && !('id' in message)) {
      // Notification from server
      this.handleNotification(message);
    }
  }
}
```

## Configuration System

### MCPConfigManager

**Location**: `src/mcp/MCPConfigManager.ts`

#### Configuration Format

```json
{
  "mcpServers": {
    "playwright": {
      "name": "playwright",
      "description": "Playwright browser automation",
      "command": "npx",
      "args": ["@playwright/mcp@latest"],
      "timeout": 30000,
      "enabled": true
    },
    "context7": {
      "name": "context7",
      "description": "Context management and file operations",
      "command": "python",
      "args": ["-m", "context7.mcp"],
      "env": {
        "CONTEXT7_API_KEY": "your-key-here"
      },
      "timeout": 30000,
      "enabled": false
    }
  }
}
```

#### Server Configuration Schema

```typescript
interface MCPServerConfig {
  name: string; // Unique server identifier
  description?: string; // Human-readable description
  command: string; // Executable command
  args?: string[]; // Command arguments
  env?: Record<string, string>; // Environment variables
  timeout?: number; // Connection timeout (ms)
  enabled?: boolean; // Default enabled state
}
```

#### Configuration Loading

```typescript
export class MCPConfigManager {
  private configs: Map<string, MCPServerConfig> = new Map();

  async loadConfigs(): Promise<void> {
    // Load from multiple sources
    await this.loadFromFile('~/.config/fosscode/mcp-config.json');
    await this.loadFromFile('./mcp-config.json');
    await this.loadFromEnvironment();
  }

  private async loadFromFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const config = JSON.parse(content);

      if (config.mcpServers) {
        for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
          this.configs.set(name, serverConfig as MCPServerConfig);
        }
      }
    } catch (error) {
      // File doesn't exist or invalid JSON - continue silently
    }
  }

  private loadFromEnvironment(): void {
    // Support environment-based configuration
    const envPrefix = 'MCP_SERVER_';

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(envPrefix)) {
        try {
          const serverName = key.slice(envPrefix.length).toLowerCase();
          const config = JSON.parse(value);
          this.configs.set(serverName, config);
        } catch (error) {
          console.warn(`Invalid MCP server config in ${key}:`, error);
        }
      }
    }
  }
}
```

## Protocol Compliance

### MCP Version Support

fosscode implements MCP Protocol version `2025-06-18` with the following capabilities:

```typescript
const capabilities = {
  tools: {}, // Tool discovery and execution
  resources: {}, // Resource access (future)
  prompts: {}, // Prompt templates (future)
  sampling: {}, // LLM sampling (future)
  elicitation: {}, // Information elicitation (future)
};
```

### Supported Methods

#### Client to Server

| Method           | Purpose                  | Implementation |
| ---------------- | ------------------------ | -------------- |
| `initialize`     | Protocol handshake       | ✅ Full        |
| `tools/list`     | Discover available tools | ✅ Full        |
| `tools/call`     | Execute a tool           | ✅ Full        |
| `resources/list` | List available resources | 🔄 Planned     |
| `resources/read` | Read resource content    | 🔄 Planned     |
| `prompts/list`   | List available prompts   | 🔄 Planned     |
| `prompts/get`    | Get prompt content       | 🔄 Planned     |

#### Server to Client

| Method                                 | Purpose                | Implementation |
| -------------------------------------- | ---------------------- | -------------- |
| `notifications/initialized`            | Confirm initialization | ✅ Full        |
| `notifications/tools/list_changed`     | Tool list updated      | 🔄 Planned     |
| `notifications/resources/list_changed` | Resource list updated  | 🔄 Planned     |
| `notifications/prompts/list_changed`   | Prompt list updated    | 🔄 Planned     |

### Message Format

#### Request

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "screenshot",
    "arguments": {
      "url": "https://example.com"
    }
  }
}
```

#### Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Screenshot captured successfully"
      },
      {
        "type": "image",
        "data": "base64-image-data",
        "mimeType": "image/png"
      }
    ]
  }
}
```

#### Error Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "details": "Missing required parameter 'url'"
    }
  }
}
```

## Tool Integration

### Tool Name Mapping

MCP tools are registered with prefixed names to avoid conflicts:

```typescript
// Original MCP tool name: "screenshot"
// Registered name: "mcp_playwright_screenshot"
const toolName = `mcp_${serverName}_${mcpTool.name}`;
```

### Tool Discovery Flow

```
1. Server Connection Established
   ↓
2. Send tools/list Request
   ↓
3. Receive Tool Definitions
   ↓
4. Convert MCP Schema to fosscode Format
   ↓
5. Register with ToolRegistry
   ↓
6. Tools Available for LLM Use
```

### Tool Execution Flow

```
1. LLM Requests Tool Execution
   ↓
2. fosscode Validates Parameters
   ↓
3. Send tools/call to MCP Server
   ↓
4. MCP Server Executes Tool
   ↓
5. Receive Result from Server
   ↓
6. Format Result for Display
   ↓
7. Return to LLM
```

### Result Processing

```typescript
function formatMCPResult(result: MCPToolResult): string {
  let output = '';

  for (const content of result.content) {
    switch (content.type) {
      case 'text':
        output += content.text + '\n';
        break;
      case 'image':
        output += `[Image: ${content.mimeType}]\n`;
        if (content.data) {
          output += `Data: ${content.data.substring(0, 100)}...\n`;
        }
        break;
      case 'resource':
        output += `[Resource: ${content.uri}]\n`;
        if (content.description) {
          output += `Description: ${content.description}\n`;
        }
        break;
      default:
        output += `[${content.type}: ${JSON.stringify(content)}]\n`;
    }
  }

  return output.trim();
}
```

## Popular MCP Servers

### Playwright MCP

**Purpose**: Browser automation and web testing
**Installation**: `npm install -g @playwright/mcp`
**Configuration**:

```json
{
  "name": "playwright",
  "command": "npx",
  "args": ["@playwright/mcp@latest"]
}
```

**Tools**: `screenshot`, `click`, `fill`, `navigate`, `wait_for_selector`

### Context7 MCP

**Purpose**: File context management and code analysis
**Installation**: `pip install context7`
**Configuration**:

```json
{
  "name": "context7",
  "command": "python",
  "args": ["-m", "context7.mcp"]
}
```

**Tools**: `add_files`, `remove_files`, `get_context`, `analyze_code`

### SQLite MCP

**Purpose**: Database operations and queries
**Installation**: `npm install -g @sqlite/mcp`
**Configuration**:

```json
{
  "name": "sqlite",
  "command": "npx",
  "args": ["@sqlite/mcp@latest"],
  "env": {
    "DATABASE_PATH": "/path/to/database.db"
  }
}
```

**Tools**: `query`, `execute`, `describe_table`, `list_tables`

### Git MCP

**Purpose**: Git repository operations
**Installation**: `npm install -g @git/mcp`
**Configuration**:

```json
{
  "name": "git",
  "command": "npx",
  "args": ["@git/mcp@latest"]
}
```

**Tools**: `status`, `diff`, `commit`, `push`, `pull`, `branch`

### Database MCP Servers

#### SQLite MCP

**Purpose**: SQLite database operations
**Installation**: `npm install -g @sqlite/mcp`
**Configuration**:

```json
{
  "name": "sqlite",
  "command": "npx",
  "args": ["@sqlite/mcp@latest"],
  "env": {
    "DATABASE_PATH": "/path/to/database.db"
  }
}
```

**Tools**: `query`, `execute`, `describe_table`, `list_tables`

#### PostgreSQL MCP

**Purpose**: PostgreSQL database operations
**Installation**: `npm install -g @postgresql/mcp`
**Configuration**:

```json
{
  "name": "postgres",
  "command": "npx",
  "args": ["@postgresql/mcp@latest"],
  "env": {
    "DATABASE_URL": "postgresql://user:pass@localhost:5432/db"
  }
}
```

**Tools**: `query`, `execute`, `describe_table`, `list_tables`, `migrations`

### Development Tools

#### ESLint MCP

**Purpose**: JavaScript/TypeScript linting and fixing
**Installation**: `npm install -g @eslint/mcp`
**Configuration**:

```json
{
  "name": "eslint",
  "command": "npx",
  "args": ["@eslint/mcp@latest"]
}
```

**Tools**: `lint`, `fix`, `format`, `check_config`

#### TypeScript MCP

**Purpose**: TypeScript compilation and type checking
**Installation**: `npm install -g @typescript/mcp`
**Configuration**:

```json
{
  "name": "typescript",
  "command": "npx",
  "args": ["@typescript/mcp@latest"]
}
```

**Tools**: `compile`, `check`, `build`, `watch`

## Usage Examples

### Basic Server Management

```bash
# List available servers
fosscode mcp list

# Enable specific server
fosscode mcp enable playwright

# Enable multiple servers
fosscode chat --mcp "playwright,context7" "Take a screenshot of google.com"

# Check server status
fosscode mcp status
```

### Configuration Examples

#### Local MCP Config (`mcp-config.json`)

```json
{
  "mcpServers": {
    "playwright": {
      "name": "playwright",
      "description": "Browser automation and testing",
      "command": "npx",
      "args": ["@playwright/mcp@latest"],
      "timeout": 30000,
      "enabled": true
    },
    "sqlite": {
      "name": "sqlite",
      "description": "SQLite database operations",
      "command": "python",
      "args": ["-m", "sqlite_mcp"],
      "env": {
        "DB_PATH": "./app.db"
      },
      "timeout": 15000,
      "enabled": false
    }
  }
}
```

#### Environment Configuration

```bash
# Set via environment variable
export MCP_SERVER_CUSTOM='{"name":"custom","command":"./custom-server","args":["--port","8080"]}'

# fosscode will automatically discover and load this configuration
```

### Integration with Providers

```typescript
// MCP tools work with any LLM provider
const providerManager = new ProviderManager(configManager);

// Enable MCP servers
const mcpManager = new MCPManager();
await mcpManager.enableServers(['playwright', 'context7']);

// Tools are automatically available to LLM
const response = await providerManager.sendMessage('openai', [
  { role: 'user', content: 'Take a screenshot of example.com and analyze the HTML structure' },
]);

// LLM can now use mcp_playwright_screenshot and mcp_context7_analyze tools
```

## Error Handling

### Connection Errors

```typescript
try {
  await mcpManager.enableServer('playwright');
} catch (error) {
  if (error.message.includes('timeout')) {
    console.error('Server failed to start within timeout period');
    console.error('Check if the server command is correct and accessible');
  } else if (error.message.includes('not found')) {
    console.error('Server configuration not found');
    console.error('Add server to mcp-config.json or via environment variable');
  } else {
    console.error('Unknown connection error:', error.message);
  }
}
```

### Tool Execution Errors

```typescript
// Automatic error handling in tool execution
const result = await tool.execute(params);

if (!result.success) {
  console.error(`Tool execution failed: ${result.error}`);

  // Attempt recovery
  if (result.error?.includes('server not connected')) {
    console.log('Attempting to reconnect to MCP server...');
    await mcpManager.enableServer(serverName);

    // Retry tool execution
    return await tool.execute(params);
  }
}
```

### Protocol Errors

```typescript
// Handle protocol-level errors
private handleMessage(message: any): void {
  if ('error' in message) {
    const error = message.error

    switch (error.code) {
      case -32700: // Parse error
        console.error('MCP Protocol: Invalid JSON received')
        break
      case -32600: // Invalid request
        console.error('MCP Protocol: Invalid request format')
        break
      case -32601: // Method not found
        console.error(`MCP Protocol: Method '${message.method}' not supported by server`)
        break
      case -32602: // Invalid params
        console.error('MCP Protocol: Invalid parameters')
        break
      default:
        console.error(`MCP Protocol Error ${error.code}: ${error.message}`)
    }
  }
}
```

## Performance Optimization

### Connection Pooling

```typescript
// Reuse connections across tool calls
const connectionPool = new Map<string, MCPProtocolHandler>()

async getConnection(serverName: string): Promise<MCPProtocolHandler> {
  if (connectionPool.has(serverName)) {
    const handler = connectionPool.get(serverName)!
    if (handler.isConnected()) {
      return handler
    }
  }

  // Create new connection
  const handler = await connectionManager.connectServer(serverConfig)
  connectionPool.set(serverName, handler)
  return handler
}
```

### Tool Caching

```typescript
// Cache tool definitions to avoid repeated discovery
const toolCache = new Map<string, MCPTool[]>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async getServerTools(serverName: string): Promise<MCPTool[]> {
  const cached = toolCache.get(serverName)
  if (cached && !this.isExpired(serverName)) {
    return cached
  }

  // Fetch from server
  const tools = await this.discoverTools(serverName)
  toolCache.set(serverName, tools)
  this.setCacheExpiry(serverName, Date.now() + CACHE_TTL)

  return tools
}
```

### Request Batching

```typescript
// Batch multiple tool calls to same server
async executeBatch(serverName: string, toolCalls: MCPToolCall[]): Promise<any[]> {
  const protocolHandler = this.getProtocolHandler(serverName)
  const promises = toolCalls.map(call =>
    this.executeSingleTool(protocolHandler, call)
  )

  return await Promise.all(promises)
}
```

## Security Considerations

### Server Validation

```typescript
// Validate server executables before spawning
async validateServerCommand(config: MCPServerConfig): Promise<void> {
  // Check if command exists and is executable
  try {
    await fs.access(config.command, fs.constants.X_OK)
  } catch {
    throw new Error(`Server command '${config.command}' is not executable`)
  }

  // Validate arguments don't contain dangerous patterns
  const dangerousPatterns = [';', '&&', '||', '|', '>', '<', '`']
  for (const arg of config.args || []) {
    if (dangerousPatterns.some(pattern => arg.includes(pattern))) {
      throw new Error(`Server argument contains dangerous pattern: ${arg}`)
    }
  }
}
```

### Sandboxing

```typescript
// Run MCP servers in restricted environment
const childProcess = spawn(config.command, config.args, {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    // Restricted environment
    PATH: '/usr/bin:/bin',
    HOME: '/tmp/mcp-sandbox',
    ...config.env,
  },
  // Additional security options
  detached: false,
  uid: process.getuid(), // Don't escalate privileges
  gid: process.getgid(),
});
```

### Input Sanitization

```typescript
// Sanitize tool parameters before sending to MCP server
private sanitizeParameters(params: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {}

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      // Remove control characters and limit length
      sanitized[key] = value.replace(/[\x00-\x1F\x7F]/g, '').substring(0, 10000)
    } else if (typeof value === 'number') {
      // Validate numeric ranges
      sanitized[key] = Math.max(-1e6, Math.min(1e6, value))
    } else if (typeof value === 'boolean') {
      sanitized[key] = Boolean(value)
    } else {
      // Skip complex objects for security
      console.warn(`Skipping parameter ${key}: unsupported type`)
    }
  }

  return sanitized
}
```

## Testing

### Unit Tests

```typescript
describe('MCPManager', () => {
  let manager: MCPManager;

  beforeEach(() => {
    manager = new MCPManager();
  });

  it('should initialize successfully', async () => {
    await manager.initialize();
    expect(manager.getAvailableServers()).toBeDefined();
  });

  it('should enable server', async () => {
    // Mock server configuration
    const config = {
      name: 'test-server',
      command: 'echo',
      args: ['{"jsonrpc":"2.0","result":{"tools":[]}}'],
    };

    await manager.enableServer('test-server');
    expect(manager.isServerEnabled('test-server')).toBe(true);
  });

  it('should handle server errors gracefully', async () => {
    const invalidConfig = {
      name: 'invalid-server',
      command: 'non-existent-command',
    };

    await expect(manager.enableServer('invalid-server')).rejects.toThrow(
      'Failed to enable MCP server'
    );
  });
});
```

### Integration Tests

```typescript
describe('MCP Integration', () => {
  it('should discover and execute tools', async () => {
    const manager = new MCPManager();
    await manager.initialize();
    await manager.enableServer('playwright');

    // Check that tools were registered
    const tools = toolRegistry.listTools();
    const playwrightTools = tools.filter(t => t.name.startsWith('mcp_playwright_'));
    expect(playwrightTools.length).toBeGreaterThan(0);

    // Execute a tool
    const screenshotTool = toolRegistry.getTool('mcp_playwright_screenshot');
    expect(screenshotTool).toBeDefined();

    const result = await screenshotTool!.execute({
      url: 'https://example.com',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });
});
```

## Future Enhancements

### Planned Features

1. **WebSocket Transport**: Support for remote MCP servers
2. **Resource Support**: File and data resource management
3. **Prompt Templates**: Dynamic prompt generation from MCP servers
4. **Server Discovery**: Automatic discovery of local MCP servers
5. **Health Monitoring**: Server health checks and automatic recovery
6. **Load Balancing**: Distribute tools across multiple server instances
7. **Caching Layer**: Intelligent caching of tool results
8. **Server Marketplace**: Discover and install MCP servers from registry

### Research Areas

- **Performance Optimization**: Minimize latency for tool execution
- **Security Hardening**: Advanced sandboxing and permission controls
- **Protocol Extensions**: Custom extensions to MCP protocol
- **AI-Powered Tool Selection**: Intelligent tool recommendation
- **Distributed MCP**: Multi-server coordination and failover
