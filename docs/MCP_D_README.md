# MCP.d Directory Support

fosscode now supports configuring multiple MCP servers through an `mcp.d` directory. This allows you to manage individual MCP server configurations as separate files, making it easier to add, remove, and manage different MCP servers.

## Directory Structure

```
~/.config/fosscode/
├── config.json          # Main configuration file
└── mcp.d/              # MCP server configurations
    ├── context7.json
    ├── playwright.json
    └── custom-server.json
```

## Configuration File Format

Each MCP server configuration is stored in a separate JSON file in the `mcp.d` directory. The filename (without `.json` extension) becomes the server name.

### Example: context7.json

```json
{
  "name": "context7",
  "mcpServerCommand": "npx",
  "mcpServerArgs": ["-y", "@upstash/context7-mcp@latest"],
  "enabled": true
}
```

### Example: playwright.json

```json
{
  "name": "playwright",
  "mcpServerCommand": "npx",
  "mcpServerArgs": ["@playwright/mcp@latest"],
  "enabled": true
}
```

### Configuration Properties

- **name** (string): Server name (should match filename)
- **mcpServerCommand** (string): Command to run the MCP server
- **mcpServerArgs** (string[]): Arguments for the MCP server command
- **mcpServerUrl** (string, optional): HTTP URL for remote MCP servers
- **enabled** (boolean, optional): Whether the server is enabled (default: true)

## Usage

### Using MCP Servers in Chat

You can specify which MCP server to use by prefixing your message with `use server:<name>`:

```bash
fosscode chat --provider mcp
```

Then in the chat:

```
use server:context7 What are the latest React hooks?
use server:playwright Take a screenshot of google.com
```

### Managing MCP Servers

#### List all configured servers

```bash
fosscode mcp list
```

#### Add a new server

```bash
fosscode mcp add myserver npx '["@myserver/mcp@latest"]'
```

#### Remove a server

```bash
fosscode mcp remove myserver
```

#### Enable/disable servers

```bash
fosscode mcp enable myserver
fosscode mcp disable myserver
```

#### Create configuration files

```bash
fosscode mcp create-config-file myserver npx '["@myserver/mcp@latest"]'
```

## Default Configuration

By default, fosscode now includes Context7 MCP server configured for immediate use:

- **Server**: context7
- **Purpose**: Up-to-date code documentation for LLMs
- **Status**: Enabled

## Migration from Single Server

If you were using the legacy single MCP server configuration, it will continue to work. The new multiple server system is backward compatible.

Your existing configuration:

```json
{
  "providers": {
    "mcp": {
      "mcpServerCommand": "npx",
      "mcpServerArgs": ["@playwright/mcp@latest"]
    }
  }
}
```

Will still work alongside any servers configured in `mcp.d`.

## Benefits

1. **Modularity**: Each server configuration is in its own file
2. **Easy Management**: Add/remove servers without editing main config
3. **Version Control Friendly**: Individual server configs can be tracked separately
4. **Flexibility**: Mix local and remote MCP servers
5. **Organization**: Better organization for multiple MCP servers

## Troubleshooting

### Configuration Not Loading

If your MCP configurations aren't loading:

1. Check that the `mcp.d` directory exists:

   ```bash
   ls -la ~/.config/fosscode/mcp.d/
   ```

2. Ensure configuration files are valid JSON:

   ```bash
   cat ~/.config/fosscode/mcp.d/context7.json
   ```

3. Reload the configuration:
   ```bash
   fosscode config reload
   ```

### Server Connection Issues

If a specific MCP server isn't connecting:

1. Check if the server is enabled:

   ```bash
   fosscode mcp list
   ```

2. Verify the server configuration:

   ```bash
   fosscode mcp enable servername
   ```

3. Test the server command manually:
   ```bash
   npx @upstash/context7-mcp@latest --help
   ```

## Examples

### Adding Context7 with API Key

```json
{
  "name": "context7",
  "mcpServerCommand": "npx",
  "mcpServerArgs": ["-y", "@upstash/context7-mcp@latest", "--api-key", "YOUR_API_KEY"],
  "enabled": true
}
```

### Adding a Remote MCP Server

```json
{
  "name": "remote-server",
  "mcpServerUrl": "https://your-mcp-server.com/mcp",
  "enabled": true
}
```

### Adding a Custom Local Server

````json
{
  "name": "custom-server",
  "mcpServerCommand": "/path/to/your/mcp-server",
  "mcpServerArgs": ["--port", "3000"],
  "enabled": true
}
```</content>
</xai:function_call">MCP_D_README.md
````
