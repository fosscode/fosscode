# fosscode

[![npm version](https://img.shields.io/npm/v/fosscode.svg)](https://www.npmjs.com/package/fosscode)
[![Discord](https://img.shields.io/badge/Discord-Join%20Chat-blue.svg)](https://discord.gg/UUVZqdPG)
[![X (formerly Twitter) Follow](https://img.shields.io/twitter/follow/fosscode)](https://x.com/fosscode)
[![Bluesky](https://img.shields.io/badge/Bluesky-Follow-blue)](https://bsky.app/profile/fosscode.bsky.social)
[![Instagram](https://img.shields.io/badge/Instagram-Follow-pink.svg)](https://www.instagram.com/fosscode/)

A lightweight, fast command-line application with a text user interface (TUI) for performing code agent interactions with Large Language Models (LLMs).

## Features

- 🖥️ **Text User Interface**: Beautiful terminal-based chat interface
- 🔄 **Multiple Providers**: Support for OpenAI, Grok, LMStudio, OpenRouter, and MCP
- 🔧 **MCP Integration**: Full Model Context Protocol support for external tools
- ⚙️ **Easy Configuration**: Simple config management for API keys and MCP servers
- 📦 **NPM Installable**: Install globally with `npm install -g fosscode`
- 🔍 **Verbose Mode**: Toggle detailed tool execution output for debugging
- 🛠️ **Tool Ecosystem**: Integrated tool system with MCP server support

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

### Global Install (Coming Soon)

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

- `fosscode chat` - Start interactive chat
- `fosscode chat "message" --non-interactive` - Send single message
- `fosscode chat --verbose` - Enable verbose output
- `fosscode auth login <provider>` - Login to provider (grok, openai, lmstudio, openrouter, mcp)
- `fosscode config set <key> <value>` - Set config values
- `fosscode providers` - List available providers

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

## Development

**Prerequisites:** Bun runtime, Node.js 18+

**Commands:**

```bash
bun install          # Install deps
bun run build        # Build for dev
bun run typecheck    # Type check
bun run lint         # Lint
bun run start        # Run app
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
