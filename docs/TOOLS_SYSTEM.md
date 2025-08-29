# fosscode Tools System Documentation

## Overview

The Tools System is a powerful extensible framework that enables LLM providers to interact with the environment through standardized tool interfaces. It provides secure, monitored execution of file operations, system commands, web requests, and other utilities while maintaining strict security controls.

## Architecture

### Tool System Hierarchy

```
ToolRegistry (Singleton)
├── BashTool           (Command execution)
├── EditTool          (File editing)
├── GrepTool          (Content search)
├── ListTool          (Directory listing)
├── ReadTool          (File reading)
├── WebFetchTool      (HTTP requests)
├── WriteTool         (File writing)
├── TodoTool          (Task management)
├── DuckDuckGoTool    (Web search)
├── GlobTool          (File pattern matching)
└── MultieditTool     (Bulk file editing)
```

### Core Components

```
Tools System
├── ToolRegistry      (Central tool management)
├── SecurityManager   (Security enforcement)
├── toolExecutor      (Execution orchestration)
└── Tool Implementations
```

## Core Interfaces

### Tool Interface

```typescript
interface Tool {
  name: string; // Unique tool identifier
  description: string; // Human-readable description
  parameters: ToolParameter[]; // Required/optional parameters
  execute(params: Record<string, any>): Promise<ToolResult>;
}

interface ToolParameter {
  name: string; // Parameter name
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string; // Parameter description
  required: boolean; // Is parameter required?
  defaultValue?: any; // Default value if not provided
}

interface ToolResult {
  success: boolean; // Execution success status
  data?: any; // Result data
  error?: string; // Error message if failed
  metadata?: Record<string, any>; // Additional metadata
}
```

### Registry Interface

```typescript
interface ToolRegistry {
  register(tool: Tool): void; // Register a new tool
  getTool(name: string): Tool | undefined; // Get tool by name
  listTools(): Tool[]; // List all tools
  unregister(name: string): boolean; // Remove tool
}
```

## Built-in Tools

### BashTool

**Location**: `src/tools/BashTool.ts`

#### Purpose

Secure execution of shell commands with comprehensive safety features.

#### Features

- **Shell Support**: Both bash and zsh execution
- **Timeout Protection**: Configurable timeouts (max 30s)
- **Output Limits**: 1MB output size limits
- **Security Validation**: Working directory validation
- **Cancellation Support**: Mid-execution cancellation
- **Auto-Installation**: Attempts to install missing tools
- **Retry Logic**: Intelligent retry with tool installation

#### Parameters

```typescript
{
  command: string,        // Required: Command to execute
  cwd?: string,          // Optional: Working directory
  timeout?: number,      // Optional: Timeout in ms (max 30000)
  shell?: string         // Optional: Shell type (bash/zsh)
}
```

#### Security Features

- **Path Validation**: Prevents directory traversal
- **Command Sanitization**: Basic command validation
- **Resource Limits**: CPU and memory constraints
- **Output Truncation**: Prevents memory exhaustion

#### Auto-Installation Logic

```typescript
// Detects missing tools and attempts installation
private detectMissingTool(command: string, stderr: string): string | null {
  const patterns = [
    { pattern: /npm: command not found/, tool: 'npm' },
    { pattern: /bun: command not found/, tool: 'bun' },
    { pattern: /python: command not found/, tool: 'python' },
    { pattern: /git: command not found/, tool: 'git' }
  ]

  // Returns tool name if detected
}

private async attemptInstallation(tool: string): Promise<boolean> {
  const installCommands = {
    npm: ['curl -L https://www.npmjs.com/install.sh | sh', 'apt-get install -y npm'],
    bun: ['curl -fsSL https://bun.sh/install | bash'],
    python: ['apt-get install -y python3', 'yum install -y python3']
  }

  // Tries multiple installation methods
}
```

### EditTool

**Location**: `src/tools/EditTool.ts`

#### Purpose

Precision file editing with string replacement operations.

#### Features

- **String Replacement**: Exact string matching and replacement
- **Multi-occurrence**: Replace first occurrence or all occurrences
- **Atomic Operations**: Temporary file creation for safe updates
- **Backup Creation**: Automatic backup before changes
- **Encoding Support**: Configurable character encoding
- **Context Validation**: Ensures target string exists

#### Parameters

```typescript
{
  filePath: string,          // Required: File to modify
  oldString: string,         // Required: String to replace
  newString: string,         // Required: Replacement string
  replaceAll?: boolean,      // Optional: Replace all occurrences
  createBackup?: boolean,    // Optional: Create backup (default: true)
  encoding?: string          // Optional: File encoding (default: utf-8)
}
```

#### Security Features

- **Path Validation**: Secure path resolution
- **File Type Restrictions**: Only allowed file extensions
- **Backup Creation**: Timestamped backup files
- **Atomic Updates**: Temporary file with atomic rename

#### Implementation Details

```typescript
async execute(params: Record<string, any>): Promise<ToolResult> {
  // 1. Validate inputs and security
  const validatedPath = await securityManager.validateFileOperation(filePath, 'write')

  // 2. Read current content
  const content = await fs.promises.readFile(validatedPath, { encoding })

  // 3. Verify string exists
  if (!content.includes(oldString)) {
    throw new Error(`String "${oldString}" not found in file`)
  }

  // 4. Create backup
  if (createBackup) {
    const backupPath = `${validatedPath}.backup.${timestamp}`
    await fs.promises.copyFile(validatedPath, backupPath)
  }

  // 5. Perform replacement atomically
  const newContent = replaceAll ? content.replaceAll(oldString, newString) : content.replace(oldString, newString)
  const tempPath = `${validatedPath}.tmp.${Date.now()}`
  await fs.promises.writeFile(tempPath, newContent)
  await fs.promises.rename(tempPath, validatedPath)
}
```

### GrepTool

**Location**: `src/tools/GrepTool.ts`

#### Purpose

Fast content search with regular expression support.

#### Features

- **Regex Support**: Full regex pattern matching
- **File Filtering**: Include/exclude file patterns
- **Recursive Search**: Directory tree traversal
- **Context Lines**: Show surrounding context
- **Performance Optimization**: Large file handling
- **Result Limiting**: Prevent excessive output

#### Parameters

```typescript
{
  pattern: string,           // Required: Search pattern (regex)
  path?: string,            // Optional: Search path (default: cwd)
  include?: string,         // Optional: File pattern to include
  exclude?: string,         // Optional: File pattern to exclude
  recursive?: boolean,      // Optional: Recursive search
  maxResults?: number       // Optional: Limit results
}
```

### ReadTool

**Location**: `src/tools/ReadTool.ts`

#### Purpose

Secure file content reading with size and type restrictions.

#### Features

- **Size Limits**: Maximum file size enforcement
- **Type Restrictions**: Only allowed file types
- **Encoding Support**: Multiple character encodings
- **Line Range**: Read specific line ranges
- **Binary Detection**: Prevents binary file reading
- **Error Handling**: Detailed error reporting

#### Parameters

```typescript
{
  filePath: string,          // Required: File to read
  encoding?: string,         // Optional: Character encoding
  startLine?: number,        // Optional: Start line number
  endLine?: number,          // Optional: End line number
  maxLines?: number          // Optional: Maximum lines to read
}
```

### WriteTool

**Location**: `src/tools/WriteTool.ts`

#### Purpose

Secure file creation and content writing.

#### Features

- **Overwrite Protection**: Prevents accidental overwrites
- **Directory Creation**: Automatic parent directory creation
- **Atomic Operations**: Safe file writing
- **Size Validation**: Content size limits
- **Permission Checking**: Write permission validation
- **Encoding Support**: Multiple character encodings

#### Parameters

```typescript
{
  filePath: string,          // Required: File to create/write
  content: string,           // Required: Content to write
  encoding?: string,         // Optional: Character encoding
  mode?: string,            // Optional: File permissions
  overwrite?: boolean       // Optional: Allow overwrite
}
```

### ListTool

**Location**: `src/tools/ListTool.ts`

#### Purpose

Directory listing and file system exploration.

#### Features

- **Detailed Metadata**: File size, permissions, timestamps
- **Filtering**: File type and name filtering
- **Sorting**: Multiple sort criteria
- **Hidden Files**: Option to show/hide hidden files
- **Recursive Listing**: Directory tree exploration
- **Size Calculation**: Directory size calculation

#### Parameters

```typescript
{
  path?: string,             // Optional: Directory path (default: cwd)
  showHidden?: boolean,      // Optional: Show hidden files
  sortBy?: string,          // Optional: Sort criteria
  recursive?: boolean,       // Optional: Recursive listing
  maxDepth?: number         // Optional: Maximum recursion depth
}
```

### WebFetchTool

**Location**: `src/tools/WebFetchTool.ts`

#### Purpose

HTTP/HTTPS request execution with security controls.

#### Features

- **Method Support**: GET, POST, PUT, DELETE, etc.
- **Header Management**: Custom request headers
- **Body Support**: JSON, form data, raw content
- **Timeout Control**: Request timeout management
- **SSL Verification**: Certificate validation
- **Redirect Handling**: Automatic redirect following
- **Response Parsing**: JSON, text, binary handling

#### Parameters

```typescript
{
  url: string,               // Required: Target URL
  method?: string,           // Optional: HTTP method
  headers?: object,          // Optional: Request headers
  body?: any,               // Optional: Request body
  timeout?: number,         // Optional: Request timeout
  followRedirects?: boolean // Optional: Follow redirects
}
```

### TodoTool

**Location**: `src/tools/TodoTool.ts`

#### Purpose

Task management and progress tracking.

#### Features

- **Task CRUD**: Create, read, update, delete tasks
- **Status Tracking**: Pending, in-progress, completed
- **Priority Levels**: High, medium, low priorities
- **Persistence**: File-based task storage
- **Filtering**: Filter by status, priority
- **Progress Tracking**: Task completion metrics

### DuckDuckGoTool

**Location**: `src/tools/DuckDuckGoTool.ts`

#### Purpose

Web search integration for information retrieval.

#### Features

- **Search Query**: Natural language search
- **Result Filtering**: Content type filtering
- **Safe Search**: Content safety controls
- **Result Limiting**: Configurable result count
- **Summary Extraction**: Key information extraction
- **Rate Limiting**: API rate limit compliance

### GlobTool

**Location**: `src/tools/GlobTool.ts`

#### Purpose

Fast file pattern matching with glob patterns for efficient file discovery.

#### Features

- **Glob Patterns**: Support for complex patterns like `**/*.ts`, `src/**/*.js`
- **Recursive Search**: Deep directory traversal
- **Ignore Patterns**: Exclude files/directories with patterns
- **Result Limiting**: Control maximum results returned
- **Sorting Options**: Sort by name, path, or modification time
- **Directory Inclusion**: Option to include directories in results
- **Performance Optimized**: Fast pattern matching for large codebases

#### Parameters

```typescript
{
  pattern: string,           // Required: Glob pattern (e.g., "**/*.ts")
  path?: string,            // Optional: Search directory (default: cwd)
  ignore?: string[],        // Optional: Patterns to ignore
  maxResults?: number,      // Optional: Limit results (default: 1000)
  includeDirs?: boolean,    // Optional: Include directories
  sortBy?: string          // Optional: Sort criteria ("name", "path", "modified")
}
```

### MultieditTool

**Location**: `src/tools/MultieditTool.ts`

#### Purpose

Bulk find-and-replace operations across multiple files with transaction-like safety.

#### Features

- **Pattern-Based Selection**: Use glob patterns to select files
- **Bulk Operations**: Process multiple files simultaneously
- **Preview Mode**: Preview changes before applying
- **Regex Support**: Regular expression find-and-replace
- **Case Sensitivity**: Configurable case sensitivity
- **Whole Word Matching**: Match complete words only
- **Transaction Safety**: Atomic operations with backup creation
- **Result Limiting**: Control maximum files processed

#### Parameters

```typescript
{
  pattern: string,          // Required: Glob pattern for file selection
  find: string,            // Required: Text to find
  replace: string,         // Required: Replacement text
  path?: string,           // Optional: Search directory
  include?: string[],      // Optional: Additional include patterns
  exclude?: string[],      // Optional: Exclude patterns
  maxFiles?: number,       // Optional: Maximum files to process
  preview?: boolean,       // Optional: Preview mode
  caseSensitive?: boolean, // Optional: Case sensitivity
  wholeWord?: boolean,     // Optional: Whole word matching
  regex?: boolean         // Optional: Use regex patterns
}
```

## Security Manager

### Location

`src/tools/SecurityManager.ts`

### Purpose

Centralized security enforcement for all tool operations.

### Security Features

#### Path Validation

```typescript
validatePath(inputPath: string): string {
  // 1. Resolve to absolute path
  const absolutePath = path.resolve(inputPath)

  // 2. Check for directory traversal
  if (normalizedPath.includes('..')) {
    throw new Error('Directory traversal detected')
  }

  // 3. Check restricted paths
  for (const restrictedPath of this.restrictedPaths) {
    if (normalizedPath.startsWith(restrictedPath)) {
      throw new Error(`Access denied: restricted area`)
    }
  }

  // 4. Validate against allowed paths
  if (!isWithinAllowedPaths(normalizedPath)) {
    throw new Error(`Access denied: not in allowed areas`)
  }
}
```

#### File Type Restrictions

```typescript
private readonly allowedFileTypes = new Set([
  '.txt', '.md', '.json', '.ts', '.js', '.py',
  '.rs', '.go', '.java', '.cpp', '.c', '.h'
])

validateFileType(filePath: string): void {
  const extension = path.extname(filePath).toLowerCase()
  if (extension && !this.allowedFileTypes.has(extension)) {
    throw new Error(`File type '${extension}' is not allowed`)
  }
}
```

#### Size Limits

```typescript
async validateFileSize(filePath: string): Promise<void> {
  const stats = await fs.promises.stat(filePath)
  if (stats.size > this.maxFileSize) {  // Default: 10MB
    throw new Error(`File size exceeds maximum allowed size`)
  }
}
```

#### Restricted Paths

```typescript
private readonly restrictedPaths = new Set([
  '/etc',     // System configuration
  '/usr',     // System programs
  '/sys',     // System information
  '/proc',    // Process information
  '/dev',     // Device files
  '/root'     // Root user directory
])
```

## Tool Execution Pipeline

### Execution Flow

```
1. Tool Call Request
   ↓
2. Parameter Validation
   ↓
3. Security Checks
   ↓
4. Tool Execution
   ↓
5. Result Formatting
   ↓
6. Response Return
```

### Tool Executor

**Location**: `src/utils/toolExecutor.ts`

#### Purpose

Orchestrates tool execution with formatting and error handling.

#### Features

##### OpenAI Format Conversion

```typescript
export function getOpenAIToolsFormat(mode?: 'code' | 'thinking') {
  const availableTools = listAvailableTools();

  // Filter tools based on mode
  if (mode === 'thinking') {
    const allowedTools = ['read', 'grep', 'list', 'webfetch'];
    filteredTools = availableTools.filter(tool => allowedTools.includes(tool.name));
  }

  // Convert to OpenAI format
  return filteredTools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: convertParameters(tool.parameters),
        required: tool.parameters.filter(p => p.required).map(p => p.name),
      },
    },
  }));
}
```

##### Tool Execution

```typescript
export async function executeToolCalls(
  toolCalls: any[],
  mode?: 'code' | 'thinking'
): Promise<ToolExecutionResult> {
  let content = 'Executing tools to help with your request...\n\n';

  for (const toolCall of toolCalls) {
    try {
      const args = JSON.parse(toolCall.function.arguments);
      const tool = getTool(toolCall.function.name);

      // Mode-based tool filtering
      if (mode === 'thinking') {
        const allowedTools = ['read', 'grep', 'list', 'webfetch'];
        if (!allowedTools.includes(toolCall.function.name)) {
          content += `❌ ${toolCall.function.name}: Tool not allowed in thinking mode\n`;
          continue;
        }
      }

      if (tool) {
        const result = await tool.execute(args);
        content += formatToolResult(toolCall.function.name, result) + '\n';
      } else {
        content += `❌ ${toolCall.function.name}: Tool not found\n`;
      }
    } catch (error) {
      content += `❌ ${toolCall.function.name}: ${error.message}\n`;
    }
  }

  return { content, hasToolCalls: toolCalls.length > 0 };
}
```

##### Result Formatting

```typescript
function formatToolResult(toolName: string, result: ToolResult): string {
  if (!result.success) {
    return `❌ ${toolName}: ${result.error ?? 'Unknown error'}`;
  }

  // Tool-specific formatting
  switch (toolName) {
    case 'bash':
      return formatBashResult(result.data);
    case 'read':
      return formatReadResult(result.data);
    case 'list':
      return formatListResult(result.data);
    case 'grep':
      return formatGrepResult(result.data);
    case 'write':
      return formatWriteResult(result.data);
    case 'edit':
      return formatEditResult(result.data);
    case 'webfetch':
      return formatWebFetchResult(result.data);
    default:
      return formatGenericResult(toolName, result.data);
  }
}
```

## Mode-Based Tool Filtering

### Code Mode

All tools available for full development capabilities.

**Available Tools:**

- BashTool (command execution)
- EditTool (file modification)
- WriteTool (file creation)
- ReadTool (file reading)
- GrepTool (content search)
- ListTool (directory listing)
- WebFetchTool (HTTP requests)
- TodoWriteTool (task management - write)
- TodoReadTool (task management - read)
- DuckDuckGoTool (web search)
- GlobTool (file pattern matching)
- MultieditTool (bulk file editing)

### Thinking Mode

Read-only tools for information gathering and analysis.

**Available Tools:**

- ReadTool (file reading only)
- GrepTool (content search only)
- ListTool (directory listing only)
- WebFetchTool (HTTP requests only)
- TodoReadTool (task reading only)
- GlobTool (file pattern matching)

**Restricted Tools:**

- BashTool (command execution blocked)
- EditTool (file modification blocked)
- WriteTool (file creation blocked)
- TodoWriteTool (task modification blocked)
- MultieditTool (bulk editing blocked)
- DuckDuckGoTool (web search blocked)

## Tool Registration System

### Dynamic Registration

```typescript
// Register tool at runtime
import { toolRegistry } from './ToolRegistry.js';
import { CustomTool } from './CustomTool.js';

toolRegistry.register(new CustomTool());
```

### Automatic Discovery

```typescript
// Tools are auto-discovered during initialization
export function initializeTools(verbose: boolean = false) {
  const tools = [
    new BashTool(),
    new EditTool(),
    new GrepTool(),
    new ListTool(),
    new ReadTool(),
    new WebFetchTool(),
    new WriteTool(),
    new TodoTool(),
    new DuckDuckGoTool(),
  ];

  tools.forEach(tool => {
    try {
      toolRegistry.register(tool);
      if (verbose) {
        console.log(`✅ Registered tool: ${tool.name}`);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to register tool ${tool.name}: ${error.message}`);
    }
  });
}
```

### Registry Management

```typescript
export class ToolRegistry implements IToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool with name '${tool.name}' is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  listTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }
}
```

## Error Handling Strategy

### Error Categories

1. **Validation Errors**: Parameter validation failures
2. **Security Errors**: Security policy violations
3. **Execution Errors**: Tool execution failures
4. **System Errors**: File system, network, or system-level failures
5. **Timeout Errors**: Operation timeout exceeded

### Error Response Format

```typescript
interface ToolResult {
  success: boolean;
  data?: any;
  error?: string; // Human-readable error message
  metadata?: {
    errorCode?: string; // Machine-readable error code
    errorType?: 'validation' | 'security' | 'execution' | 'system' | 'timeout';
    stack?: string; // Stack trace for debugging
    [key: string]: any;
  };
}
```

### Error Handling Implementation

```typescript
async execute(params: Record<string, any>): Promise<ToolResult> {
  try {
    // Tool execution logic
    return {
      success: true,
      data: result,
      metadata: { executedAt: new Date().toISOString() }
    }
  } catch (error) {
    // Categorize error
    let errorType: string
    let errorCode: string

    if (error instanceof ValidationError) {
      errorType = 'validation'
      errorCode = 'INVALID_PARAMETER'
    } else if (error instanceof SecurityError) {
      errorType = 'security'
      errorCode = 'ACCESS_DENIED'
    } else if (error instanceof TimeoutError) {
      errorType = 'timeout'
      errorCode = 'EXECUTION_TIMEOUT'
    } else {
      errorType = 'execution'
      errorCode = 'EXECUTION_FAILED'
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      metadata: {
        errorCode,
        errorType,
        stack: error instanceof Error ? error.stack : undefined
      }
    }
  }
}
```

## Performance Optimization

### Caching Strategy

```typescript
// Tool execution result caching
const executionCache = new Map<string, ToolResult>();

function getCacheKey(toolName: string, params: Record<string, any>): string {
  return `${toolName}:${JSON.stringify(params)}`;
}

async function executeWithCache(tool: Tool, params: Record<string, any>): Promise<ToolResult> {
  const cacheKey = getCacheKey(tool.name, params);

  // Check cache for read-only operations
  if (['read', 'list', 'grep'].includes(tool.name)) {
    const cached = executionCache.get(cacheKey);
    if (cached) return cached;
  }

  const result = await tool.execute(params);

  // Cache successful read operations
  if (result.success && ['read', 'list', 'grep'].includes(tool.name)) {
    executionCache.set(cacheKey, result);
  }

  return result;
}
```

### Resource Management

```typescript
// Concurrent execution limits
const MAX_CONCURRENT_TOOLS = 3;
const activeToolExecutions = new Set<Promise<ToolResult>>();

async function executeToolWithLimits(tool: Tool, params: Record<string, any>): Promise<ToolResult> {
  // Wait if too many tools are running
  while (activeToolExecutions.size >= MAX_CONCURRENT_TOOLS) {
    await Promise.race(activeToolExecutions);
  }

  const execution = tool.execute(params);
  activeToolExecutions.add(execution);

  try {
    return await execution;
  } finally {
    activeToolExecutions.delete(execution);
  }
}
```

### Memory Management

```typescript
// Output size limits
const MAX_OUTPUT_SIZE = 1024 * 1024; // 1MB

function truncateOutput(data: any): any {
  if (typeof data === 'string' && data.length > MAX_OUTPUT_SIZE) {
    return data.substring(0, MAX_OUTPUT_SIZE) + '\n[Output truncated...]';
  }
  return data;
}
```

## Testing Framework

### Tool Testing Template

```typescript
import { describe, it, expect } from '@jest/globals';
import { BashTool } from '../BashTool.js';

describe('BashTool', () => {
  let tool: BashTool;

  beforeEach(() => {
    tool = new BashTool();
  });

  it('should execute simple commands', async () => {
    const result = await tool.execute({
      command: 'echo "hello world"',
      timeout: 5000,
    });

    expect(result.success).toBe(true);
    expect(result.data.stdout).toBe('hello world');
    expect(result.data.exitCode).toBe(0);
  });

  it('should handle command timeout', async () => {
    const result = await tool.execute({
      command: 'sleep 10',
      timeout: 1000,
    });

    expect(result.success).toBe(true);
    expect(result.data.timedOut).toBe(true);
  });

  it('should validate working directory', async () => {
    const result = await tool.execute({
      command: 'pwd',
      cwd: '/invalid/path',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid path');
  });
});
```

### Integration Testing

```typescript
describe('Tool Integration', () => {
  it('should chain tool operations', async () => {
    const writeTool = new WriteTool();
    const readTool = new ReadTool();
    const editTool = new EditTool();

    // Write file
    const writeResult = await writeTool.execute({
      filePath: '/tmp/test.txt',
      content: 'original content',
    });
    expect(writeResult.success).toBe(true);

    // Read file
    const readResult = await readTool.execute({
      filePath: '/tmp/test.txt',
    });
    expect(readResult.success).toBe(true);
    expect(readResult.data.content).toBe('original content');

    // Edit file
    const editResult = await editTool.execute({
      filePath: '/tmp/test.txt',
      oldString: 'original',
      newString: 'modified',
    });
    expect(editResult.success).toBe(true);

    // Verify edit
    const finalRead = await readTool.execute({
      filePath: '/tmp/test.txt',
    });
    expect(finalRead.data.content).toBe('modified content');
  });
});
```

## Extending the Tools System

### Creating Custom Tools

```typescript
import { Tool, ToolParameter, ToolResult } from '../types/index.js';

export class CustomTool implements Tool {
  name = 'custom-tool';
  description = 'Description of custom functionality';

  parameters: ToolParameter[] = [
    {
      name: 'input',
      type: 'string',
      description: 'Input parameter description',
      required: true,
    },
    {
      name: 'options',
      type: 'object',
      description: 'Optional configuration',
      required: false,
      defaultValue: {},
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      // 1. Validate parameters
      if (!params.input || typeof params.input !== 'string') {
        throw new Error('Invalid input parameter');
      }

      // 2. Security checks if needed
      // await securityManager.validateOperation(params)

      // 3. Perform tool logic
      const result = await this.performOperation(params.input, params.options);

      // 4. Return success result
      return {
        success: true,
        data: result,
        metadata: {
          executedAt: new Date().toISOString(),
          toolVersion: '1.0.0',
        },
      };
    } catch (error) {
      // 5. Handle errors gracefully
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          errorType: 'execution',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private async performOperation(input: string, options: any): Promise<any> {
    // Custom tool logic implementation
    return { processed: input, options };
  }
}
```

### Tool Registration

```typescript
// Register the custom tool
import { toolRegistry } from '../ToolRegistry.js';
import { CustomTool } from './CustomTool.js';

// During initialization
toolRegistry.register(new CustomTool());

// Verify registration
const tool = toolRegistry.getTool('custom-tool');
console.log(`Tool registered: ${tool?.name}`);
```

### Best Practices

1. **Parameter Validation**: Always validate input parameters
2. **Security First**: Use SecurityManager for file operations
3. **Error Handling**: Provide clear, actionable error messages
4. **Resource Limits**: Implement timeouts and size limits
5. **Atomic Operations**: Use temporary files for safe updates
6. **Metadata**: Include useful execution metadata
7. **Testing**: Write comprehensive unit and integration tests
8. **Documentation**: Document parameters and behavior clearly

## Future Enhancements

### Planned Features

1. **Tool Marketplace**: Third-party tool discovery and installation
2. **Tool Composition**: Chain multiple tools in workflows
3. **Caching Layer**: Intelligent result caching with invalidation
4. **Async Operations**: Background task execution
5. **Tool Monitoring**: Performance metrics and health checks
6. **Permission System**: Fine-grained tool access controls
7. **Plugin Architecture**: Dynamic tool loading and sandboxing
8. **Visual Tool Builder**: GUI for creating custom tools

### Research Areas

- **AI-Powered Tools**: Tools that use LLMs for enhanced functionality
- **Distributed Execution**: Execute tools across multiple machines
- **Tool Optimization**: Automatic tool selection and optimization
- **Security Enhancements**: Advanced sandboxing and isolation
- **Performance Profiling**: Detailed tool execution analytics
