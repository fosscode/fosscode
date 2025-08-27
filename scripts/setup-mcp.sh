#!/bin/bash

# Fosscode MCP Setup Script
# This script helps set up MCP configuration for Playwright

echo "🚀 Setting up Fosscode MCP Configuration for Playwright"
echo ""

# Check if Playwright MCP is installed
echo "📦 Checking if Playwright MCP server is installed..."
if ! npm list @playwright/mcp >/dev/null 2>&1; then
    echo "❌ Playwright MCP server not found. Installing..."
    npm install @playwright/mcp --legacy-peer-deps
    echo "✅ Playwright MCP server installed successfully!"
else
    echo "✅ Playwright MCP server is already installed"
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
      "mcpServerArgs": ["@playwright/mcp@latest"],
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
echo "🎉 Setup complete! You can now use MCP with Playwright:"
echo ""
echo "  # Start interactive chat with MCP tools"
echo "  fosscode chat --provider mcp"
echo ""
echo "  # Take a screenshot"
echo "  fosscode chat \"Take a screenshot of google.com\" --provider mcp --non-interactive"
echo ""
echo "  # See available MCP tools"
echo "  fosscode chat \"What tools do you have available?\" --provider mcp"
echo ""
echo "📖 For more information, see the MCP section in README.md"