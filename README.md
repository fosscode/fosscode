# fosscode

[![npm version](https://img.shields.io/npm/v/fosscode.svg)](https://www.npmjs.com/package/fosscode)
[![Reproducible Builds](https://img.shields.io/badge/Reproducible%20Builds-✅-green.svg)](https://github.com/fosscode/fosscode)
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
- 🔒 **Reproducible Builds**: Consistent build artifacts across environments

## Installation

### Development Setup

```bash
git clone <repository-url>
cd fosscode
bun install
bun run start auth login <provider>  # grok, openai, etc.
bun run start chat
```

### Docker (Recommended for VPS)

```bash
# Pull pre-built image
docker pull ghcr.io/fosscode/fosscode:latest
docker run -it --rm ghcr.io/fosscode/fosscode:latest chat

# Or build locally
docker build -t fosscode .
docker run -it --rm fosscode chat
```

### Binary Installation (Latest: v0.0.28)

Download the latest pre-built binaries for your platform:

#### Linux

- **x64**: [fosscode-linux-x64](https://github.com/fosscode/fosscode/releases/download/v0.0.28/fosscode-linux-x64) | [Signature](https://github.com/fosscode/fosscode/releases/download/v0.0.28/fosscode-linux-x64.asc)
- **ARM64**: [fosscode-linux-arm64](https://github.com/fosscode/fosscode/releases/download/v0.0.28/fosscode-linux-arm64) | [Signature](https://github.com/fosscode/fosscode/releases/download/v0.0.28/fosscode-linux-arm64.asc)

#### macOS

- **Intel (x64)**: [fosscode-macos-x64](https://github.com/fosscode/fosscode/releases/download/v0.0.28/fosscode-macos-x64) | [Signature](https://github.com/fosscode/fosscode/releases/download/v0.0.28/fosscode-macos-x64.asc)
- **Apple Silicon (ARM64)**: [fosscode-macos-arm64](https://github.com/fosscode/fosscode/releases/download/v0.0.28/fosscode-macos-arm64) | [Signature](https://github.com/fosscode/fosscode/releases/download/v0.0.28/fosscode-macos-arm64.asc)

#### Windows

- **x64**: [fosscode-windows-x64.exe](https://github.com/fosscode/fosscode/releases/download/v0.0.28/fosscode-windows-x64.exe) | [Signature](https://github.com/fosscode/fosscode/releases/download/v0.0.28/fosscode-windows-x64.exe.asc)

**Installation Steps:**

```bash
# Download the appropriate binary for your platform
curl -L -o fosscode https://github.com/fosscode/fosscode/releases/download/v0.0.28/fosscode-linux-x64  # Replace with your platform
chmod +x fosscode
sudo mv fosscode /usr/local/bin/  # Or add to your PATH
```

**Verify Installation:**

```bash
# Verify the binary signature (optional)
gpg --keyserver hkps://keyserver.ubuntu.com --recv-keys 5A4818774F6CA92319CE88A45ACBB22988757D6E
gpg --verify fosscode.asc fosscode
```

### NPM Install (Coming Soon)

```bash
npm install -g fosscode
```

## Quick Start

1. **Login:** `fosscode auth login grok` (or openai)
2. **Chat:** `fosscode chat`
3. **Specific provider:** `fosscode chat --provider grok --model grok-1`
4. **Single message:** `fosscode chat "message" --non-interactive --provider grok`
5. **Verbose mode:** `fosscode chat "message" --verbose --provider sonicfree`
6. **MCP tools:** `fosscode chat "Take screenshot" --provider mcp`

## Commands

### Core Commands

- `fosscode chat` - Start interactive chat
- `fosscode chat "message" --non-interactive` - Send single message
- `fosscode chat --verbose` - Enable verbose output
- `fosscode auth login <provider>` - Login to provider (grok, openai, lmstudio, openrouter, mcp)
- `fosscode config set <key> <value>` - Set config values
- `fosscode providers` - List available providers
- `fosscode models [provider]` - List available models

### Interactive Chat Commands

- `/clear` - Clear conversation history
- `/verbose` - Toggle verbose mode
- `/themes` - Switch between dark/light themes
- `/memory` - Show memory usage statistics
- `/gc` - Trigger garbage collection
- `/compress` - Compress conversation history to save memory
- `/mode` or `/thinking` - Switch between code and thinking modes
- `Tab` key - Quickly switch between code and thinking modes
- `@` symbol - Enter file search mode to attach files

### Configuration Commands

- `fosscode config set <key> <value>` - Set configuration values
- `fosscode themes [theme]` - Manage themes (dark/light)

## Providers & Authentication

Authenticate with at least one provider before chatting:

- **Grok (xAI)**: `fosscode auth login grok` | API key: <https://console.x.ai/>
- **OpenAI**: `fosscode auth login openai` | API key: <https://platform.openai.com/api-keys>
- **LMStudio (Local)**: `fosscode auth login lmstudio` | Configure server URL (default: http://localhost:1234)
- **OpenRouter**: `fosscode auth login openrouter` | API key: <https://openrouter.ai/keys>
- **MCP (Model Context Protocol)**: `fosscode auth login mcp` | Enables external tools via standardized servers

### MCP Configuration

Configure MCP servers via command or URL:

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

Usage: `fosscode chat --provider mcp` | Tools auto-discovered and registered

## Non-Interactive & Verbose Modes

**Non-Interactive Mode** (for automation/scripting):

```bash
fosscode chat "message" --non-interactive --provider grok
echo "data" | fosscode chat --non-interactive --provider grok
```

Features: Direct console output, token stats, exits after response, works with all providers.

**Verbose Mode** (debug tool execution):

```bash
fosscode chat "message" --verbose --provider sonicfree
# In interactive chat: /verbose
```

Shows tool calls, results, and AI behavior details.

## Interactive Features

### File Search & Attachment

Attach files to your conversation by typing `@` to enter file search mode:

- Type `@` followed by search terms to find files
- Use arrow keys to navigate search results
- Press `Enter` to attach selected file
- Press `Escape` to exit file search mode

### Mode Switching

Switch between different AI modes for specialized tasks:

- **Code Mode** (default): Optimized for programming tasks
- **Thinking Mode**: Enhanced reasoning and analysis
- Switch with `Tab` key or `/mode` command

### Memory Management

Monitor and optimize memory usage:

- `/memory` - View current memory statistics
- `/gc` - Manually trigger garbage collection
- `/compress` - Compress conversation history when it gets long
- Automatic cleanup prevents memory bloat during long sessions

### Conversation Management

- Conversations are automatically limited to prevent excessive memory usage
- Use `/clear` to reset conversation history
- Use `/compress` to summarize long conversations

## Configuration

Stored in `~/.config/fosscode/config.json` (XDG standard). Configure API keys, defaults, UI prefs, and provider settings.

See [`config.example.json`](config.example.json) for full options.

**Commands:**

```bash
fosscode config set providers.openai.apiKey sk-your-key-here
fosscode config set defaultProvider openai
fosscode config set defaultModel gpt-4
fosscode config set providers.openai.timeout 60000
```

Auto-migrates from legacy `~/.fosscode/config.json`.

## Usage Examples

### Basic Chat Session

```bash
# Start interactive chat with default provider
fosscode chat

# Chat with specific provider and model
fosscode chat --provider grok --model grok-1

# Send single message (non-interactive)
fosscode chat "Explain how recursion works" --non-interactive --provider openai
```

### File Operations with AI

```bash
# Start chat and use @ to search for files
fosscode chat
# Then type: @package.json
# Select file and ask: "Analyze this package.json file"
```

### MCP Tool Usage

```bash
# Use MCP server for browser automation
fosscode chat --provider mcp
# Then ask: "Take a screenshot of google.com"
```

### Memory Management

```bash
# Monitor memory usage
fosscode chat
# Then type: /memory

# Compress long conversation
/compress

# Clear conversation history
/clear
```

## Troubleshooting

### Common Issues

**"Provider not configured" error**

```bash
# Login to the provider first
fosscode auth login grok
```

**High memory usage**

```bash
# In chat session:
/memory    # Check usage
/compress  # Compress history
/gc        # Force garbage collection
/clear     # Clear conversation
```

**Slow responses**

- Try different models: `fosscode models grok`
- Switch providers: `fosscode chat --provider openai`
- Check your internet connection

**MCP server not working**

```bash
# Verify MCP configuration
fosscode config set providers.mcp.mcpServerCommand npx
fosscode config set providers.mcp.mcpServerArgs '["@playwright/mcp@latest"]'
```

### Performance Optimization

The application includes several performance optimizations:

- **Lazy Loading**: Providers are loaded only when needed
- **Memory Limits**: Conversation history is automatically limited
- **Connection Pooling**: Efficient API request handling with retries
- **Bundle Optimization**: Minified builds for smaller footprint

### Getting Help

- Check this README for common solutions
- Use `/memory` and `/verbose` commands for debugging
- Review configuration in `~/.config/fosscode/config.json`
- Check logs and error messages for specific issues

## Performance & Requirements

### System Requirements

- **Node.js**: 18.0.0 or higher
- **Bun**: 1.2.21+ (recommended for development)
- **Memory**: 50MB RAM minimum, 100MB recommended
- **Storage**: ~2MB for installation
- **Network**: Internet connection for LLM providers

### Performance Characteristics

- **Startup Time**: < 500ms (typically 200-300ms)
- **Memory Usage**: ~50MB RSS during normal operation
- **Bundle Size**: 1.8MB (minified)
- **Response Time**: Depends on LLM provider (typically 1-10 seconds)

### Optimization Features

- Automatic conversation history limiting
- Lazy loading of LLM providers
- Connection pooling with retry logic
- Memory monitoring and cleanup commands
- Efficient data structures for chat history

## Development

**Prerequisites:** Bun runtime, Node.js 18+

**Commands:**

```bash
bun install          # Install deps
bun run build        # Build for dev
bun run typecheck    # Type check
bun run lint         # Lint
bun run start        # Run app
bun run perf         # Run performance tests
bun test             # Run test suite
```

## Deployment

**Docker (Recommended):**

```bash
docker build -t fosscode .
docker run -it --rm -v ~/.config/fosscode:/root/.config/fosscode fosscode chat
```

**Bun Runtime:**

```bash
curl -fsSL https://bun.sh/install | bash
git clone <repo> && cd fosscode && bun install && bun run start chat
```

## Project Structure

```
src/
├── index.ts           # CLI entry
├── types/             # Type defs
├── config/            # Config mgmt
├── providers/         # LLM providers
└── ui/                # TUI components
```

## Donations

If you find fosscode helpful, consider supporting the project with a donation! 🚀

**Ethereum (ETH):** [`0x861A5b09A58AAB7B89fc1d138f6f82fF3471E489`](https://etherscan.io/address/0x861A5b09A58AAB7B89fc1d138f6f82fF3471E489)

_Copy the address above or click the link to view on Etherscan_

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

[![Star History Chart](https://api.star-history.com/svg?repos=fosscode/fosscode&type=Date)](https://star-history.com/#fosscode/fosscode&Date)
