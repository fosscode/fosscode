# fosscode Development Guidelines

## Overview

This document provides comprehensive guidelines for developing, contributing to, and maintaining the fosscode project. It covers coding standards, development workflow, testing practices, and architectural principles to ensure consistent, high-quality code.

## Table of Contents

- [Development Environment Setup](#development-environment-setup)
- [Code Style and Standards](#code-style-and-standards)
- [Architecture Principles](#architecture-principles)
- [Development Workflow](#development-workflow)
- [Testing Guidelines](#testing-guidelines)
- [Security Guidelines](#security-guidelines)
- [Performance Guidelines](#performance-guidelines)
- [Documentation Standards](#documentation-standards)
- [Release Process](#release-process)
- [Contribution Guidelines](#contribution-guidelines)

## Development Environment Setup

### Prerequisites

```bash
# Required tools
node --version    # >= 18.0.0
bun --version     # Latest stable
git --version     # Latest stable
```

### Initial Setup

```bash
# Clone repository
git clone https://github.com/fosscode/fosscode.git
cd fosscode

# Install dependencies
bun install

# Run development setup
bun run setup

# Start development server
bun run dev
```

### Development Tools

#### VS Code Configuration

`.vscode/settings.json`:

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.exclude": {
    "node_modules": true,
    "dist": true,
    ".git": true
  }
}
```

#### Recommended Extensions

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.test-adapter-converter",
    "orta.vscode-jest"
  ]
}
```

## Code Style and Standards

### TypeScript Configuration

#### Strict Type Checking

```typescript
// tsconfig.json - Key settings
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true
  }
}
```

#### Type Definitions

```typescript
// ✅ Good: Explicit type definitions
interface UserConfig {
  readonly apiKey: string;
  readonly timeout?: number;
  readonly retries?: number;
}

// ❌ Bad: Any types
interface UserConfig {
  apiKey: any;
  timeout: any;
}

// ✅ Good: Union types for finite options
type Theme = 'dark' | 'light';

// ❌ Bad: String type for limited options
type Theme = string;
```

### Coding Standards

#### Naming Conventions

```typescript
// ✅ Good: Clear, descriptive names
const MAX_RETRY_ATTEMPTS = 3;
const isConfigurationValid = true;
const userApiKey = 'sk-...';

class ProviderManager {
  private connectionPool: Map<string, Connection>;

  async initializeProvider(providerType: ProviderType): Promise<void> {
    // Implementation
  }
}

// ❌ Bad: Unclear, abbreviated names
const MAX_RETRY = 3;
const valid = true;
const key = 'sk-...';

class PM {
  private pool: Map<string, any>;

  async init(type: any): Promise<void> {
    // Implementation
  }
}
```

#### Function Design

```typescript
// ✅ Good: Single responsibility, clear parameters
async function validateApiKey(apiKey: string, provider: ProviderType): Promise<boolean> {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  return await provider.validateCredentials(apiKey);
}

// ❌ Bad: Multiple responsibilities, unclear parameters
async function processConfig(config: any): Promise<any> {
  // Validates config, saves to disk, initializes providers, etc.
}

// ✅ Good: Pure functions when possible
function formatErrorMessage(error: Error, context: string): string {
  return `[${context}] ${error.message}`;
}

// ✅ Good: Immutable operations
function updateProviderConfig(
  config: AppConfig,
  provider: ProviderType,
  updates: Partial<LLMConfig>
): AppConfig {
  return {
    ...config,
    providers: {
      ...config.providers,
      [provider]: {
        ...config.providers[provider],
        ...updates,
      },
    },
  };
}
```

#### Error Handling

```typescript
// ✅ Good: Specific error types and messages
class ProviderConfigurationError extends Error {
  constructor(
    public readonly provider: ProviderType,
    message: string,
    public readonly cause?: Error
  ) {
    super(`Provider '${provider}': ${message}`);
    this.name = 'ProviderConfigurationError';
  }
}

// ✅ Good: Comprehensive error handling
async function connectToProvider(config: LLMConfig): Promise<Connection> {
  try {
    validateConfiguration(config);
    const connection = await establishConnection(config);
    return connection;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new ProviderConfigurationError(config.provider, 'Invalid configuration', error);
    }

    if (error instanceof NetworkError) {
      throw new ProviderConfigurationError(config.provider, 'Connection failed', error);
    }

    throw error; // Re-throw unexpected errors
  }
}

// ❌ Bad: Generic error handling
async function connectToProvider(config: any): Promise<any> {
  try {
    return await doStuff(config);
  } catch (error) {
    throw new Error('Something went wrong');
  }
}
```

### ESLint Configuration

`.eslintrc.json`:

```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-explicit-any": "error",
    "prefer-const": "error",
    "no-var": "error",
    "no-console": "warn",
    "max-len": ["warn", { "code": 100 }]
  }
}
```

### Prettier Configuration

`.prettierrc`:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

## Architecture Principles

### Separation of Concerns

```typescript
// ✅ Good: Clear separation
class UserInterface {
  // UI logic only
}

class BusinessLogic {
  // Business rules only
}

class DataAccess {
  // Data operations only
}

// ❌ Bad: Mixed concerns
class UserManager {
  // UI, business logic, and data access mixed
}
```

### Dependency Injection

```typescript
// ✅ Good: Dependencies injected
class ChatCommand {
  constructor(
    private providerManager: ProviderManager,
    private configManager: ConfigManager,
    private logger: Logger
  ) {}
}

// ❌ Bad: Hard-coded dependencies
class ChatCommand {
  private providerManager = new ProviderManager();
  private configManager = new ConfigManager();
}
```

### Interface Segregation

```typescript
// ✅ Good: Specific interfaces
interface Readable {
  read(path: string): Promise<string>;
}

interface Writable {
  write(path: string, content: string): Promise<void>;
}

interface FileOperations extends Readable, Writable {}

// ❌ Bad: Monolithic interface
interface FileSystem {
  read(): Promise<string>;
  write(): Promise<void>;
  delete(): Promise<void>;
  chmod(): Promise<void>;
  chown(): Promise<void>;
  // ... 20+ methods
}
```

### Error Propagation

```typescript
// ✅ Good: Structured error propagation
async function processUserRequest(request: UserRequest): Promise<Result<Response, Error>> {
  try {
    const validated = await validateRequest(request);
    const processed = await processRequest(validated);
    const response = await formatResponse(processed);

    return Result.success(response);
  } catch (error) {
    return Result.failure(error);
  }
}

// ✅ Good: Domain-specific errors
class ValidationError extends Error {
  constructor(field: string, value: unknown, expectedType: string) {
    super(`Invalid ${field}: expected ${expectedType}, got ${typeof value}`);
  }
}
```

## Development Workflow

### Git Workflow

#### Branch Naming

```bash
# Feature branches
feature/provider-system-refactor
feature/add-anthropic-provider

# Bug fix branches
fix/config-validation-edge-case
fix/memory-leak-in-tool-execution

# Hotfix branches
hotfix/security-vulnerability-fix

# Release branches
release/v0.2.0
```

#### Commit Messages

```bash
# ✅ Good: Clear, descriptive commits
git commit -m "feat(providers): add Anthropic Claude integration

- Implement AnthropicProvider class with API client
- Add authentication flow for Anthropic API keys
- Include model listing and validation
- Add comprehensive error handling
- Update provider registration in ProviderManager

Closes #123"

# ✅ Good: Bug fix commits
git commit -m "fix(config): prevent prototype pollution in nested config keys

- Add validation for dangerous key names (__proto__, constructor, prototype)
- Sanitize configuration keys before processing
- Add tests for security validation
- Update error messages for clarity

Fixes #456"

# ❌ Bad: Vague commits
git commit -m "fix stuff"
git commit -m "update code"
git commit -m "wip"
```

#### Pull Request Process

1. **Create Feature Branch**

   ```bash
   git checkout -b feature/new-awesome-feature
   ```

2. **Implement Changes**
   - Write code following style guidelines
   - Add comprehensive tests
   - Update documentation

3. **Run Pre-commit Checks**

   ```bash
   bun run lint
   bun run typecheck
   bun run test
   bun run build
   ```

4. **Create Pull Request**
   - Clear title and description
   - Link related issues
   - Include testing evidence
   - Request appropriate reviewers

5. **Address Review Feedback**
   - Make requested changes
   - Respond to comments
   - Update tests as needed

6. **Merge**
   - Use squash merge for clean history
   - Delete feature branch after merge

### Local Development

#### Development Commands

```bash
# Development server with hot reload
bun run dev

# Type checking
bun run typecheck

# Linting
bun run lint
bun run lint --fix

# Testing
bun run test
bun run test --watch
bun run test --coverage

# Building
bun run build
bun run build:exe

# Release preparation
bun run release:patch
bun run release:minor
bun run release:major
```

#### Environment Setup

```bash
# .env.development
NODE_ENV=development
LOG_LEVEL=debug
FOSSCODE_PROVIDER=mock

# .env.test
NODE_ENV=test
FOSSCODE_PROVIDER=mock

# .env.production
NODE_ENV=production
LOG_LEVEL=info
```

## Testing Guidelines

### Testing Strategy

#### Test Pyramid

```
         /\
        /  \
       / UI \
      /Tests\
     /______\
    /        \
   /Integration\
  /   Tests     \
 /______________\
/                \
/   Unit Tests   \
/________________\
```

#### Test Categories

1. **Unit Tests** (70%): Individual functions and classes
2. **Integration Tests** (20%): Component interactions
3. **End-to-End Tests** (10%): Full user workflows

### Unit Testing

#### Test Structure

```typescript
// ✅ Good: Descriptive test structure
describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let mockFileSystem: MockFileSystem;

  beforeEach(() => {
    mockFileSystem = new MockFileSystem();
    configManager = new ConfigManager(mockFileSystem);
  });

  describe('loadConfig', () => {
    it('should load configuration from file successfully', async () => {
      // Arrange
      const expectedConfig = { defaultProvider: 'openai' };
      mockFileSystem.setFileContent('/config.json', JSON.stringify(expectedConfig));

      // Act
      await configManager.loadConfig();
      const actualConfig = configManager.getConfig();

      // Assert
      expect(actualConfig.defaultProvider).toBe('openai');
    });

    it('should use default configuration when file does not exist', async () => {
      // Arrange
      mockFileSystem.setFileExists('/config.json', false);

      // Act
      await configManager.loadConfig();
      const config = configManager.getConfig();

      // Assert
      expect(config.defaultProvider).toBe('openai'); // Default value
    });

    it('should throw error when configuration file is corrupted', async () => {
      // Arrange
      mockFileSystem.setFileContent('/config.json', 'invalid json');

      // Act & Assert
      await expect(configManager.loadConfig()).rejects.toThrow('Invalid configuration file');
    });
  });
});
```

#### Mocking Best Practices

```typescript
// ✅ Good: Interface-based mocking
interface FileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
}

class MockFileSystem implements FileSystem {
  private files: Map<string, string> = new Map();

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (!content) throw new Error('File not found');
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  setFileContent(path: string, content: string): void {
    this.files.set(path, content);
  }
}

// ❌ Bad: Implementation-specific mocking
jest.mock('fs', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));
```

### Integration Testing

```typescript
// ✅ Good: Integration test
describe('Provider Integration', () => {
  it('should initialize provider and execute tool successfully', async () => {
    // Arrange
    const configManager = new ConfigManager();
    const providerManager = new ProviderManager(configManager);
    const toolRegistry = new ToolRegistry();

    await configManager.setProviderConfig('openai', {
      apiKey: process.env.OPENAI_API_KEY_TEST,
    });

    // Act
    await providerManager.initializeProvider('openai');
    const response = await providerManager.sendMessage('openai', [
      { role: 'user', content: 'Hello' },
    ]);

    // Assert
    expect(response.content).toBeTruthy();
    expect(response.usage).toBeDefined();
  });
});
```

### Test Utilities

```typescript
// Test utilities for consistent setup
export class TestUtils {
  static createMockConfig(overrides: Partial<AppConfig> = {}): AppConfig {
    return {
      ...ConfigDefaults.getDefaultConfig(),
      ...overrides,
    };
  }

  static createMockProvider(responses: string[]): LLMProvider {
    let responseIndex = 0;

    return {
      async sendMessage(): Promise<ProviderResponse> {
        return {
          content: responses[responseIndex++] || 'Mock response',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          finishReason: 'stop',
        };
      },

      async listModels(): Promise<string[]> {
        return ['mock-model-1', 'mock-model-2'];
      },

      async validateConfig(): Promise<boolean> {
        return true;
      },
    };
  }
}
```

## Security Guidelines

### Input Validation

```typescript
// ✅ Good: Comprehensive input validation
function validateApiKey(apiKey: unknown): string {
  if (typeof apiKey !== 'string') {
    throw new ValidationError('API key must be a string');
  }

  if (apiKey.length < 10 || apiKey.length > 200) {
    throw new ValidationError('API key length is invalid');
  }

  if (!/^[a-zA-Z0-9\-_]+$/.test(apiKey)) {
    throw new ValidationError('API key contains invalid characters');
  }

  return apiKey;
}

// ✅ Good: File path validation
function validateFilePath(filePath: string): string {
  if (!path.isAbsolute(filePath)) {
    throw new SecurityError('File path must be absolute');
  }

  const normalizedPath = path.normalize(filePath);
  if (normalizedPath.includes('..')) {
    throw new SecurityError('Path traversal detected');
  }

  return normalizedPath;
}
```

### Secure Configuration

```typescript
// ✅ Good: Secure configuration handling
class SecureConfigManager {
  private readonly RESTRICTED_KEYS = ['__proto__', 'constructor', 'prototype'];

  async setConfig(key: string, value: unknown): Promise<void> {
    // Validate key safety
    const keys = key.split('.');
    for (const k of keys) {
      if (this.RESTRICTED_KEYS.includes(k)) {
        throw new SecurityError(`Restricted key: ${k}`);
      }
    }

    // Sanitize value
    const sanitizedValue = this.sanitizeValue(value);

    // Store configuration
    await this.storeConfig(key, sanitizedValue);
  }

  private sanitizeValue(value: unknown): unknown {
    if (typeof value === 'string') {
      // Remove control characters
      return value.replace(/[\x00-\x1F\x7F]/g, '');
    }

    return value;
  }
}
```

### Authentication Security

```typescript
// ✅ Good: Secure API key handling
class AuthManager {
  async storeApiKey(provider: ProviderType, apiKey: string): Promise<void> {
    // Validate API key format
    this.validateApiKeyFormat(provider, apiKey);

    // Hash API key for logging (never log the actual key)
    const hashedKey = this.hashApiKey(apiKey);
    this.logger.info(`Storing API key for ${provider}`, { keyHash: hashedKey });

    // Store encrypted
    const encryptedKey = await this.encryptApiKey(apiKey);
    await this.configManager.setProviderConfig(provider, {
      apiKey: encryptedKey,
    });
  }

  private hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex').substring(0, 8);
  }

  private async encryptApiKey(apiKey: string): Promise<string> {
    // Use system keychain or simple encryption for config file
    return apiKey; // Simplified for example
  }
}
```

## Performance Guidelines

### Memory Management

```typescript
// ✅ Good: Efficient memory usage
class ToolExecutor {
  private readonly MAX_CONCURRENT_TOOLS = 5;
  private readonly activeExecutions = new Set<Promise<any>>();

  async executeTool(tool: Tool, params: any): Promise<ToolResult> {
    // Limit concurrent executions
    if (this.activeExecutions.size >= this.MAX_CONCURRENT_TOOLS) {
      await Promise.race(this.activeExecutions);
    }

    const execution = this.performExecution(tool, params);
    this.activeExecutions.add(execution);

    try {
      return await execution;
    } finally {
      this.activeExecutions.delete(execution);
    }
  }
}

// ✅ Good: Resource cleanup
class ConnectionManager {
  private connections = new Map<string, Connection>();

  async getConnection(id: string): Promise<Connection> {
    let connection = this.connections.get(id);

    if (!connection || !connection.isAlive()) {
      // Clean up dead connection
      if (connection) {
        await connection.cleanup();
        this.connections.delete(id);
      }

      // Create new connection
      connection = await this.createConnection(id);
      this.connections.set(id, connection);
    }

    return connection;
  }

  async cleanup(): Promise<void> {
    for (const connection of this.connections.values()) {
      await connection.cleanup();
    }
    this.connections.clear();
  }
}
```

### Caching Strategy

```typescript
// ✅ Good: TTL-based caching
class CacheManager<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  set(key: string, value: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}
```

### Async Optimization

```typescript
// ✅ Good: Parallel execution when possible
async function initializeProviders(providers: ProviderType[]): Promise<void> {
  const initPromises = providers.map(provider =>
    this.initializeProvider(provider).catch(error => {
      this.logger.warn(`Failed to initialize ${provider}:`, error);
      return null; // Don't fail entire initialization
    })
  );

  await Promise.allSettled(initPromises);
}

// ✅ Good: Streaming for large data
async function processLargeResponse(response: ReadableStream): Promise<string> {
  const reader = response.getReader();
  const chunks: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);

      // Prevent memory issues with very large responses
      if (chunks.length > 1000) {
        throw new Error('Response too large');
      }
    }

    return chunks.join('');
  } finally {
    reader.releaseLock();
  }
}
```

## Documentation Standards

### Code Documentation

````typescript
/**
 * Manages LLM provider connections and request routing
 *
 * @example
 * ```typescript
 * const manager = new ProviderManager(configManager)
 * await manager.initializeProvider('openai')
 * const response = await manager.sendMessage('openai', messages)
 * ```
 */
export class ProviderManager {
  /**
   * Initialize a specific provider with validation
   *
   * @param providerType - The provider to initialize
   * @throws {ProviderConfigurationError} When provider config is invalid
   * @throws {NetworkError} When provider is unreachable
   */
  async initializeProvider(providerType: ProviderType): Promise<void> {
    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerType}`);
    }

    // Validate configuration
    const config = this.configManager.getProviderConfig(providerType);
    const isValid = await provider.validateConfig(config);

    if (!isValid) {
      throw new ProviderConfigurationError(
        providerType,
        'Invalid configuration. Please check your API key and settings.'
      );
    }
  }
}
````

### README Structure

```markdown
# Component Name

## Purpose

Brief description of what this component does.

## Usage

Basic usage example with code.

## API Reference

Detailed method documentation.

## Configuration

Configuration options and examples.

## Error Handling

Common errors and solutions.

## Performance Considerations

Performance tips and limitations.

## Testing

How to test this component.
```

## Release Process

### Version Management

```bash
# Semantic versioning
# MAJOR.MINOR.PATCH

# Patch release (bug fixes)
./scripts/release.sh patch    # 1.0.0 -> 1.0.1

# Minor release (new features)
./scripts/release.sh minor    # 1.0.1 -> 1.1.0

# Major release (breaking changes)
./scripts/release.sh major    # 1.1.0 -> 2.0.0
```

### Release Checklist

- [ ] All tests passing
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Git tag created
- [ ] Binaries built and uploaded
- [ ] Release notes published

### Automated Release Workflow

```bash
# 1. Prepare release
./scripts/release.sh patch

# 2. Create GitHub release
gh release create v1.0.1 --title "Release v1.0.1" --generate-notes

# 3. Build and upload binaries
./scripts/build-binaries.sh v1.0.1

# 4. Publish to npm (if applicable)
npm publish
```

## Contribution Guidelines

### Getting Started

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/yourusername/fosscode.git
   ```
3. **Install dependencies**
   ```bash
   bun install
   ```
4. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Development Process

1. **Write code** following style guidelines
2. **Add tests** for new functionality
3. **Update documentation** as needed
4. **Run quality checks**
   ```bash
   bun run lint
   bun run typecheck
   bun run test
   ```
5. **Commit with clear messages**
6. **Push and create pull request**

### Pull Request Guidelines

#### PR Title Format

```
type(scope): brief description

Examples:
feat(providers): add Anthropic Claude integration
fix(config): resolve prototype pollution vulnerability
docs(api): update provider documentation
```

#### PR Description Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Screenshots (if applicable)

Add screenshots for UI changes

## Checklist

- [ ] My code follows the style guidelines
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
```

### Review Process

1. **Automated checks** must pass
2. **At least one approval** from maintainer
3. **Address feedback** promptly
4. **Squash merge** to maintain clean history

### Community Guidelines

- **Be respectful** and professional
- **Provide constructive feedback**
- **Help others** learn and improve
- **Follow the Code of Conduct**
- **Ask questions** when unclear

### Issue Reporting

#### Bug Reports

```markdown
**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:

1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Environment:**

- OS: [e.g. iOS]
- Browser [e.g. chrome, safari]
- Version [e.g. 22]

**Additional context**
Add any other context about the problem here.
```

#### Feature Requests

```markdown
**Is your feature request related to a problem? Please describe.**
A clear and concise description of what the problem is.

**Describe the solution you'd like**
A clear and concise description of what you want to happen.

**Describe alternatives you've considered**
A clear and concise description of any alternative solutions.

**Additional context**
Add any other context or screenshots about the feature request here.
```

## Best Practices Summary

### Code Quality

- Write self-documenting code with clear names
- Keep functions small and focused
- Use TypeScript strict mode
- Handle errors explicitly
- Write comprehensive tests

### Architecture

- Follow SOLID principles
- Use dependency injection
- Separate concerns clearly
- Design for testability
- Plan for extensibility

### Performance

- Profile before optimizing
- Use caching strategically
- Manage memory carefully
- Optimize for the common case
- Measure actual performance impact

### Security

- Validate all inputs
- Sanitize user data
- Use secure defaults
- Implement proper error handling
- Follow security best practices

### Collaboration

- Write clear commit messages
- Document your code
- Review others' code constructively
- Share knowledge
- Maintain consistent style

## Tools and Resources

### Development Tools

- **Bun**: Package manager and runtime
- **TypeScript**: Type checking
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Jest**: Testing framework
- **Ink**: Terminal UI framework

### Documentation Tools

- **TypeDoc**: API documentation generation
- **Markdown**: Documentation format
- **Mermaid**: Diagrams and flowcharts

### CI/CD Tools

- **GitHub Actions**: Automated workflows
- **Dependabot**: Dependency updates
- **CodeQL**: Security analysis

This development guide ensures consistent, high-quality contributions to fosscode while maintaining security, performance, and maintainability standards.
