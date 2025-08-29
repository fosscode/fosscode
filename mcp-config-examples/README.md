# MCP Server Configuration Examples

This directory contains example configurations for MCP (Model Context Protocol) servers.

## Directory Structure

To use these configurations, copy the `.json` files to:

```
~/.config/fosscode/mcp.d/
```

## Configuration Format

Each MCP server configuration is a JSON file with the following structure:

```json
{
  "name": "server-name",
  "description": "Human-readable description",
  "command": "command-to-run",
  "args": ["arg1", "arg2"],
  "env": {
    "ENV_VAR": "value"
  },
  "timeout": 30000,
  "enabled": false
}
```

### Fields

- `name` (required): Unique identifier for the server
- `description` (optional): Human-readable description
- `command` (required): Executable command to start the server
- `args` (optional): Array of command arguments
- `env` (optional): Environment variables to set
- `timeout` (optional): Connection timeout in milliseconds (default: 30000)
- `enabled` (optional): Whether the server should be enabled by default (default: false)

## Example Configurations

### Playwright MCP Server

For browser automation and testing:

```json
{
  "name": "playwright",
  "description": "Playwright MCP server for browser automation and testing",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-playwright"],
  "env": {
    "PLAYWRIGHT_BROWSERS_PATH": "/usr/bin/chromium-browser"
  },
  "timeout": 30000,
  "enabled": false
}
```

### Context7 MCP Server

For context-aware operations:

```json
{
  "name": "context7",
  "description": "Context7 MCP server for context-aware operations",
  "command": "context7-mcp-server",
  "args": ["--port", "3000"],
  "env": {
    "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}",
    "CONTEXT7_BASE_URL": "https://api.context7.ai"
  },
  "timeout": 15000,
  "enabled": false
}
```

## Usage

Once configured, you can:

1. **Enable servers via command line:**

   ```bash
   fosscode --mcp playwright,context7
   ```

2. **Enable/disable servers in chat:**

   ```
   /mcp enable playwright
   /mcp disable context7
   /mcp status
   ```

3. **Use MCP tools:**
   Once enabled, MCP tools will be available as regular fosscode tools with the prefix `mcp_{server}_{tool}`.

## Installation

Make sure MCP servers are installed:

```bash
# For Playwright
npm install -g @modelcontextprotocol/server-playwright

# For other servers, follow their respective installation instructions
```

## Notes

- Servers are disabled by default for security
- Each server runs as a separate process
- Tools are automatically registered/unregistered when servers are enabled/disabled
- Configuration files are loaded on startup
