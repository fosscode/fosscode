# fosscode

[![npm version](https://img.shields.io/npm/v/fosscode.svg)](https://www.npmjs.com/package/fosscode)
[![Discord](https://img.shields.io/badge/Discord-Join%20Chat-blue.svg)](https://discord.gg/UUVZqdPG)
[![X (formerly Twitter) Follow](https://img.shields.io/twitter/follow/fosscode)](https://x.com/fosscode)
[![Bluesky](https://img.shields.io/badge/Bluesky-Follow-blue)](https://bsky.app/profile/fosscode.bsky.social)
[![Instagram](https://img.shields.io/badge/Instagram-Follow-pink.svg)](https://www.instagram.com/fosscode/)

A lightweight, fast command-line application with a text user interface (TUI) for performing code agent interactions with Large Language Models (LLMs).

## Features

- 🚀 **Lightweight & Fast**: Optimized for minimal resource usage
- 🖥️ **Text User Interface**: Beautiful terminal-based chat interface
- 🔄 **Multiple Providers**: Support for OpenAI, Grok, LMStudio, OpenRouter, and MCP
- 🔧 **MCP Integration**: Full Model Context Protocol support for external tools
- ⚙️ **Easy Configuration**: Simple config management for API keys and MCP servers
- 📦 **NPM Installable**: Install globally with `npm install -g fosscode`
- 🔍 **Verbose Mode**: Toggle detailed tool execution output for debugging
- 🛠️ **Tool Ecosystem**: Integrated tool system with MCP server support

## Installation

### Quick Start (Development)

```bash
git clone <repository-url>
cd fosscode
bun install

# Login to a provider (choose one)
bun run start auth login grok
# or
bun run start auth login openai

# Start chatting
bun run start chat
```

### Docker Deployment (Recommended for VPS)

#### Using Pre-built Images from GitHub Container Registry

```bash
# Pull the latest image (supports both AMD64 and ARM64)
docker pull ghcr.io/fosscode/fosscode:latest

# Run with Docker
docker run -it --rm ghcr.io/fosscode/fosscode:latest chat

# Run with a specific message
docker run -it --rm ghcr.io/fosscode/fosscode:latest chat "Hello, how are you?"

# With persistent config volume
docker run -it --rm -v ~/.config/fosscode:/root/.config/fosscode ghcr.io/fosscode/fosscode:latest chat
```

**💡 Tip:** Use a specific provider and model:

```bash
docker run -it --rm ghcr.io/fosscode/fosscode:latest chat -p sonicfree "Hello, how are you?"
```

#### Build from Source

```bash
# Build Docker image locally
docker build -t fosscode .

# Run with Docker
docker run -it --rm fosscode chat

# Or use docker-compose
docker-compose up fosscode
```

### Global Installation (Coming Soon)

```bash
npm install -g fosscode
```

## Quick Start

1. **Login to a provider:**

   ```bash
   fosscode auth login grok
   # or
   fosscode auth login openai
   ```

2. **Start chatting:**

   ```bash
   fosscode chat
   ```

3. **Use a specific provider:**

   ```bash
   fosscode chat --provider grok --model grok-1
   ```

4. **Non-interactive mode (single message):**

   ```bash
   fosscode chat "Explain quantum computing in simple terms" --non-interactive --provider grok
   ```

5. **Verbose mode (see tool execution details):**

   ```bash
   fosscode chat "edit the poem to have name" --non-interactive --verbose --provider sonicfree
   ```

6. **MCP tools (external integrations):**
   ```bash
   fosscode chat "Take a screenshot of example.com" --non-interactive --provider mcp
   ```

## Commands

- `fosscode chat` - Start interactive chat session
- `fosscode chat "message" --non-interactive` - Send single message and get response
- `fosscode chat --verbose` - Enable verbose output (shows tool execution details)
- `fosscode auth login <provider>` - Login to a provider and store API credentials
- `fosscode auth login mcp` - Configure MCP server settings
- `fosscode config set <key> <value>` - Set configuration values
- `fosscode providers` - List available LLM providers

## Authentication

Before using the chat feature, you need to authenticate with at least one provider:

### xAI/Grok

```bash
fosscode auth login grok
```

Get your API key from: <https://console.x.ai/>

**Status**: ✅ Fully implemented and ready to use

### OpenAI

```bash
fosscode auth login openai
```

Get your API key from: <https://platform.openai.com/api-keys>

### LMStudio (Local)

```bash
fosscode auth login lmstudio
```

Configure your local LMStudio server URL (default: http://localhost:1234)

**Status**: ✅ Implemented (local server configuration)

### OpenRouter

```bash
fosscode auth login openrouter
```

Get your API key from: <https://openrouter.ai/keys>

**Status**: 🔄 Ready for implementation

### MCP (Model Context Protocol)

```bash
fosscode auth login mcp
```

The Model Context Protocol (MCP) enables fosscode to integrate with external tools and services through standardized server interfaces.

#### Supported MCP Servers

- **Playwright MCP Server**: Browser automation and web scraping
- **Custom MCP Servers**: Any MCP-compliant server

#### Configuration

MCP servers can be configured in two ways:

**Option 1: Command-based (Recommended)**

```json
{
  "providers": {
    "mcp": {
      "mcpServerCommand": "npx",
      "mcpServerArgs": ["@playwright/mcp@latest"],
      "timeout": 30000,
      "verbose": true
    }
  }
}
```

**Option 2: URL-based**

```json
{
  "providers": {
    "mcp": {
      "mcpServerUrl": "http://localhost:3000",
      "timeout": 30000,
      "verbose": true
    }
  }
}
```

#### Usage Examples

```bash
# Chat with MCP tools
fosscode chat --provider mcp

# Use Playwright to take screenshots
fosscode chat "Take a screenshot of google.com" --provider mcp

# List available MCP tools
fosscode chat "What tools do you have available?" --provider mcp
```

#### MCP Tool Integration

When you connect to an MCP server, its tools are automatically:

- Discovered and registered with fosscode's tool system
- Made available as `mcp_<tool_name>` in the tool registry
- Executable through fosscode's standard tool execution pipeline

**Status**: ✅ Fully implemented with JSON-RPC 2.0 protocol support

The login process will:

- Prompt you for your API key or server details
- Validate the credentials format
- Store them securely in your config file
- Test the connection (when applicable)

## Non-Interactive Mode

fosscode supports a non-interactive mode for automation, testing, and scripting:

```bash
# Send a single message and get response
fosscode chat "What is the weather like?" --non-interactive --provider grok

# Use with different providers
fosscode chat "Explain this code" --non-interactive --provider openai --model gpt-4

# Use MCP tools for external integrations
fosscode chat "Take a screenshot of google.com" --non-interactive --provider mcp

# Perfect for scripts and automation
echo "Analyze this data:" | fosscode chat --non-interactive --provider grok
```

**Features:**

- ✅ Prints response directly to console
- ✅ Includes token usage statistics
- ✅ Exits immediately after response
- ✅ Perfect for automation and CI/CD
- ✅ Works with all providers and models

## Verbose Mode

fosscode supports verbose mode to show detailed tool execution information, which is helpful for debugging and understanding what the AI is doing:

### Non-Interactive Mode

```bash
# Enable verbose output to see tool execution details
fosscode chat "edit the poem to have name" --non-interactive --verbose --provider sonicfree
```

### Interactive Mode

```bash
# Start interactive chat
fosscode chat --provider sonicfree

# In the chat, type:
/verbose  # Toggle verbose mode on/off
```

**Verbose Mode Features:**

- 🔍 **Tool Execution Details**: Shows which tools are being executed and their results
- 🔄 **Toggle Support**: Can be toggled on/off during interactive sessions
- 📝 **Debug Friendly**: Perfect for understanding AI behavior and troubleshooting
- ⚙️ **Configurable**: Works with all providers that support tool execution

**Example Verbose Output:**

```
🤖 fosscode - sonicfree (sonic)
You: edit the poem to have  name
Thinking...
Assistant:

[Tool Calls Executed]:
✅ read: {
  "filePath": "story.txt",
  "content": "Roses are red,\nViolets are blue,\nSugar is sweet,\nAnd so are you.",
  "totalLines": 4,
  "readLines": 4,
  "startLine": 1,
  "endLine": 4,
  "encoding": "utf-8",
  "truncated": false
}
✅ edit: File story.txt updated successfully

Done. The poem in story.txt has been edited to include name.
```

## Configuration

The application stores configuration in `~/.config/fosscode/config.json` (following XDG Base Directory specification). You can configure:

- API keys for different providers
- Default provider and model
- UI preferences
- Provider-specific settings (timeouts, retries, etc.)

### Configuration File Format

See [`config.example.json`](config.example.json) for a complete example configuration file with all available options.

### Basic Configuration Commands

```bash
# Set OpenAI API key
fosscode config set providers.openai.apiKey sk-your-key-here

# Set default provider
fosscode config set defaultProvider openai

# Set default model
fosscode config set defaultModel gpt-4

# Set theme
fosscode config set theme light
```

### Advanced Configuration

You can also manually edit the configuration file or use nested keys:

```bash
# Set provider-specific timeout
fosscode config set providers.openai.timeout 60000

# Set max retries for Grok
fosscode config set providers.grok.maxRetries 5

# Enable verbose mode for LMStudio
fosscode config set providers.lmstudio.verbose true
```

### Configuration Location

- **Primary**: `~/.config/fosscode/config.json` (XDG standard)
- **Fallback**: `~/.fosscode/config.json` (legacy support)

The app will automatically migrate from the old location if it exists, creating a backup of your original config.

## Supported Providers

- **OpenAI**: GPT-3.5, GPT-4 models
- **Grok**: xAI's Grok models
- **LMStudio**: Local model server
- **OpenRouter**: Unified API access (coming soon)
- **MCP**: Model Context Protocol servers (experimental)

### MCP (Model Context Protocol) Servers

fosscode supports connecting to MCP servers, which provide tools and data sources through the Model Context Protocol.

#### Playwright MCP Server

The Playwright MCP server enables browser automation capabilities:

```json
{
  "providers": {
    "mcp": {
      "mcpServerCommand": "npx",
      "mcpServerArgs": ["@playwright/mcp@latest"],
      "timeout": 30000,
      "verbose": true
    }
  }
}
```

To use the Playwright MCP server:

```bash
# Install globally (optional)
npm install -g @playwright/mcp

# Or use directly with npx
fosscode config set providers.mcp.mcpServerCommand npx
fosscode config set providers.mcp.mcpServerArgs '["@playwright/mcp@latest"]'
```

#### Other MCP Servers

You can configure fosscode to work with any MCP server by specifying the command and arguments:

```json
{
  "providers": {
    "mcp": {
      "mcpServerCommand": "python",
      "mcpServerArgs": ["-m", "my_mcp_server", "--port", "3000"],
      "timeout": 30000,
      "verbose": true
    }
  }
}
```

## Development

### Prerequisites

- Bun runtime
- Node.js 18+ (for compatibility)

### Build Commands

```bash
bun install          # Install dependencies
bun run build        # Build for development
bun run build:exe    # Create executable binary (may have TUI issues)
bun run typecheck    # Run TypeScript type checking
bun run lint         # Run ESLint
bun run format       # Format code with Prettier
bun run start        # Run the application
```

## Deployment

### For VPS/Lightweight Hosts

**Option 1: Docker (Recommended)**

```bash
# Build and run
docker build -t fosscode .
docker run -it --rm fosscode chat

# With persistent config
docker run -it --rm -v ~/.fosscode:/home/nodejs/.fosscode fosscode chat
```

**Option 2: Direct Bun Runtime**

```bash
# Install Bun on your VPS
curl -fsSL https://bun.sh/install | bash

# Deploy your code
git clone <your-repo>
cd fosscode
bun install
bun run start chat
```

### Project Structure

```
src/
├── index.ts           # CLI entry point
├── types/             # TypeScript type definitions
├── config/            # Configuration management
├── providers/         # LLM provider implementations
│   ├── ProviderManager.ts
│   ├── OpenAIProvider.ts
│   └── ...            # Other providers
└── ui/                # TUI components
    └── App.tsx
```

## Donations

0x861A5b09A58AAB7B89fc1d138f6f82fF3471E489

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) for details on:

- How to contribute code
- Our Contributor License Agreement (CLA) requirements
- Development setup and guidelines
- Pull request process

**Important**: All contributors must sign our CLA before their contributions can be accepted.

## License

MIT License - see LICENSE file for details.

---

[![GitHub stars](https://img.shields.io/github/stars/fosscode/fosscode.svg)](https://github.com/fosscode/fosscode/stargazers)
