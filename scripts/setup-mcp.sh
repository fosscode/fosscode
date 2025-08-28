#!/bin/bash

# Fosscode MCP Setup Script
# This script helps set up MCP configuration for Context7

echo "🚀 Setting up Fosscode MCP Configuration for Context7"
echo ""

# Check if Context7 MCP is installed
echo "📦 Checking if Context7 MCP server is available..."
if ! npx @upstash/context7-mcp@latest --help >/dev/null 2>&1; then
    echo "❌ Context7 MCP server not accessible. Please ensure npx is available."
    exit 1
else
    echo "✅ Context7 MCP server is accessible via npx"
fi

echo ""
echo "📁 Setting up configuration directory..."
mkdir -p ~/.config/fosscode

echo ""
echo "⚙️  Creating MCP configuration..."
cat > ~/.config/fosscode/config.json << 'EOF'
{
  "defaultProvider": "mcp",
  "defaultModel": "mcp-server",
  "maxConversations": 100,
  "theme": "dark",
  "providers": {
    "mcp": {
      "mcpServerCommand": "npx",
      "mcpServerArgs": ["-y", "@upstash/context7-mcp@latest"],
      "timeout": 30000,
      "verbose": true
    }
  },
  "cachedModels": {
    "mcp": {
      "models": ["mcp-server"],
      "lastUpdated": "2024-01-01T00:00:00.000Z",
      "expiresAt": "2024-01-02T00:00:00.000Z"
    }
  }
}
EOF

echo "✅ MCP configuration created at ~/.config/fosscode/config.json"
echo ""
echo "🎉 Setup complete! You can now use MCP with Context7:"
echo ""
echo "  # Start interactive chat with MCP tools"
echo "  fosscode chat --provider mcp"
echo ""
echo "  # Use Context7 tools"
echo "  fosscode chat \"Help me analyze this codebase\" --provider mcp --non-interactive"
echo ""
echo "  # See available MCP tools"
echo "  fosscode chat \"What tools do you have available?\" --provider mcp"
echo ""
echo "📖 For more information, see the MCP section in README.md"