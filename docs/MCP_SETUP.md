# Fosscode MCP Setup Guide

This guide helps you set up Model Context Protocol (MCP) support in fosscode with Playwright for browser automation.

## Quick Setup

### Option 1: Automated Setup (Recommended)

Run the setup script to automatically configure everything:

```bash
chmod +x setup-mcp.sh
./setup-mcp.sh
```

This will:

- Install the Playwright MCP server if needed
- Create the configuration directory
- Set up the MCP configuration file

### Option 2: Manual Setup

1. **Install Playwright MCP Server:**

   ```bash
   npm install @playwright/mcp --legacy-peer-deps
   ```

2. **Create Configuration Directory:**

   ```bash
   mkdir -p ~/.config/fosscode
   ```

3. **Copy Configuration:**
   ```bash
   cp mcp-config.json ~/.config/fosscode/config.json
   ```

## Configuration Details

The MCP configuration uses Playwright as the MCP server:

```json
{
  "defaultProvider": "mcp",
  "defaultModel": "mcp-server",
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

### Configuration Options

- **mcpServerCommand**: Command to run the MCP server (`npx`)
- **mcpServerArgs**: Arguments for the MCP server (`["@playwright/mcp@latest"]`)
- **timeout**: Connection timeout in milliseconds (30000)
- **verbose**: Enable detailed logging (true)

## Usage Examples

### Configure MCP Once

```bash
# Set up MCP configuration
fosscode config set providers.mcp.mcpServerCommand npx
fosscode config set providers.mcp.mcpServerArgs '["@playwright/mcp@latest"]'
```

### Use MCP Tools with ANY Provider

```bash
# MCP tools now work with any provider!
fosscode chat "Take a screenshot of google.com" --provider grok
fosscode chat "Navigate to example.com" --provider openai --non-interactive
fosscode chat "Click the login button" --provider anthropic
```

### List Available Tools

```bash
# Works with any configured provider
fosscode chat "What MCP tools do you have available?" --provider grok
```

## Available Playwright Tools

Once connected, you'll have access to tools like:

- **Browser Navigation**: Navigate to URLs, go back/forward
- **Screenshots**: Take screenshots of pages or elements
- **Element Interaction**: Click buttons, fill forms, extract text
- **Page Analysis**: Get page content, find elements, check visibility
- **PDF Generation**: Convert pages to PDF
- **Mobile Emulation**: Test with different device sizes

## Troubleshooting

### Connection Issues

If you see connection errors:

1. Make sure Playwright MCP is installed: `npm list @playwright/mcp`
2. Check that the config file exists: `cat ~/.config/fosscode/config.json`
3. Try running with verbose mode: `fosscode chat --provider mcp --verbose`

### Tool Discovery Issues

If tools aren't appearing:

1. Restart fosscode to refresh the tool registry
2. Check MCP server logs with verbose mode
3. Verify Playwright MCP server can start: `npx @playwright/mcp@latest --help`

### Permission Issues

If you see permission errors:

1. Make sure the config directory is writable: `ls -la ~/.config/fosscode/`
2. Check that fosscode can access the MCP server command

## Advanced Configuration

### Using a Different MCP Server

To use a different MCP server, modify the configuration:

```json
{
  "providers": {
    "mcp": {
      "mcpServerCommand": "/path/to/your/mcp-server",
      "mcpServerArgs": ["--port", "3000"],
      "timeout": 30000,
      "verbose": true
    }
  }
}
```

### URL-based Configuration

For MCP servers that support HTTP:

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

## Next Steps

1. Run the setup script or manually configure MCP
2. Test the connection: `fosscode chat --provider mcp`
3. Explore available tools and try browser automation
4. Check the main README.md for more MCP usage examples

## Support

For issues with MCP setup:

- Check the main README.md for detailed MCP documentation
- Use verbose mode to see detailed connection logs
- Verify Playwright MCP server compatibility

---

🎉 **Happy automating with MCP and Playwright!**</content>
</xai:function_call">MCP_SETUP.md
