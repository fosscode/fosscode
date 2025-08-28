# fosscode Usage Examples

This document provides comprehensive examples of how to use fosscode for various tasks and scenarios.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Provider-Specific Examples](#provider-specific-examples)
- [File Operations](#file-operations)
- [MCP Tool Integration](#mcp-tool-integration)
- [Memory Management](#memory-management)
- [Automation & Scripting](#automation--scripting)
- [Advanced Features](#advanced-features)

## Basic Usage

### Starting Your First Chat

```bash
# Login to a provider (choose one)
fosscode auth login grok
# or
fosscode auth login openai

# Start interactive chat
fosscode chat

# Chat with specific provider
fosscode chat --provider grok --model grok-1
```

### Single Message Mode

```bash
# Ask a quick question
fosscode chat "What is the capital of France?" --non-interactive --provider grok

# Get help with code
fosscode chat "How do I reverse a string in JavaScript?" --non-interactive --provider openai

# Use with pipes
echo "Explain this code:" | cat - myfile.js | fosscode chat --non-interactive --provider grok
```

## Provider-Specific Examples

### Grok (xAI) - Creative and Helpful AI

```bash
# Creative writing assistance
fosscode chat --provider grok --model grok-1
# Ask: "Write a short story about a robot learning to paint"

# Technical explanations
fosscode chat "Explain quantum computing in simple terms" --non-interactive --provider grok

# Code review
fosscode chat "Review this JavaScript function for best practices" --non-interactive --provider grok
```

### OpenAI - Versatile and Powerful

```bash
# Complex reasoning tasks
fosscode chat --provider openai --model gpt-4
# Ask: "Design a microservices architecture for an e-commerce platform"

# Creative coding
fosscode chat "Generate a React component for a todo list" --non-interactive --provider openai

# Documentation
fosscode chat "Write comprehensive API documentation for this endpoint" --non-interactive --provider openai
```

### LMStudio - Local AI Models

```bash
# Use local models (no API key needed)
fosscode auth login lmstudio
fosscode chat --provider lmstudio

# Specify custom server URL if needed
fosscode config set providers.lmstudio.baseURL http://localhost:1234
```

### OpenRouter - Access Multiple Models

```bash
# Access various models through OpenRouter
fosscode auth login openrouter
fosscode chat --provider openrouter --model anthropic/claude-3-haiku

# List available models
fosscode models openrouter
```

## File Operations

### Attaching Files to Conversations

```bash
# Start chat and attach files
fosscode chat

# In the chat interface:
# 1. Type @ followed by search terms
# 2. Use arrow keys to select files
# 3. Press Enter to attach
# 4. Ask questions about the attached files

# Example conversation:
# User: @package.json
# [Select package.json]
# User: "Analyze this package.json and suggest improvements"
```

### Working with Code Files

```bash
# Analyze a specific file
fosscode chat
# Attach: @src/index.ts
# Ask: "Review this code for potential bugs"

# Get refactoring suggestions
fosscode chat
# Attach: @components/Button.tsx
# Ask: "How can I optimize this React component?"

# Documentation generation
fosscode chat
# Attach: @api/routes.js
# Ask: "Generate comprehensive API documentation for these routes"
```

### Project Analysis

```bash
# Analyze entire project structure
fosscode chat
# Attach multiple files: @package.json @README.md @src/
# Ask: "Analyze this project structure and provide improvement suggestions"

# Code review session
fosscode chat --provider gpt-4
# Attach: @src/components/ @src/utils/
# Ask: "Perform a comprehensive code review of these components"
```

## MCP Tool Integration

### Browser Automation with Playwright

```bash
# Configure MCP server
fosscode config set providers.mcp.mcpServerCommand npx
fosscode config set providers.mcp.mcpServerArgs '["@playwright/mcp@latest"]'

# Use browser automation
fosscode chat --provider mcp
# Ask: "Take a screenshot of google.com"
# Ask: "Navigate to github.com and find the most popular JavaScript repositories"
# Ask: "Fill out this form with test data"
```

### Custom MCP Servers

```bash
# Configure custom MCP server
fosscode config set providers.mcp.mcpServerCommand python
fosscode config set providers.mcp.mcpServerArgs '["-m", "my_mcp_server"]'

# Use custom tools
fosscode chat --provider mcp
# Access to any tools provided by your MCP server
```

## Memory Management

### Monitoring Memory Usage

```bash
# Check memory usage
fosscode chat
# Type: /memory

# Output example:
# 📊 Memory Usage:
# • RSS: 45 MB
# • Heap Used: 32 MB
# • Heap Total: 48 MB
# • External: 2 MB
# • Conversation messages: 23/100
```

### Managing Long Conversations

```bash
# Compress conversation when it gets long
fosscode chat
# After many messages...
# Type: /compress
# AI will summarize the conversation history

# Clear conversation entirely
/clear

# Force garbage collection
/gc
```

### Optimizing for Long Sessions

```bash
# Monitor memory regularly during long sessions
fosscode chat
# Periodically type: /memory

# Compress when conversation gets long
# Type: /compress (when you see high message counts)

# Switch to thinking mode for complex analysis
# Type: /mode or press Tab
```

## Automation & Scripting

### Batch Processing

```bash
# Process multiple files
for file in src/*.ts; do
  echo "Analyzing $file..."
  fosscode chat "Review this TypeScript file for best practices" \
    --non-interactive --provider grok < "$file"
done
```

### CI/CD Integration

```bash
# Code review in CI pipeline
#!/bin/bash
echo "Running AI code review..."
fosscode chat "Review these changes for potential issues" \
  --non-interactive --provider gpt-4 < diff.txt

# Automated testing assistance
fosscode chat "Generate unit tests for this function" \
  --non-interactive --provider grok < function.js
```

### Log Analysis

```bash
# Analyze application logs
tail -n 100 app.log | fosscode chat \
  "Analyze these log entries and identify any patterns or issues" \
  --non-interactive --provider grok
```

## Advanced Features

### Mode Switching

```bash
# Switch between modes for different tasks
fosscode chat

# Code mode (default) - optimized for programming
# Type: /mode (switches to thinking mode)
# Type: /mode again (switches back to code mode)

# Or use Tab key for quick switching
# Press Tab to toggle between modes
```

### Verbose Mode for Debugging

```bash
# Enable verbose output to see tool execution
fosscode chat --verbose
# or in chat: /verbose

# Useful for debugging MCP tool execution
fosscode chat --provider mcp --verbose
# Shows detailed tool calls and responses
```

### Theme Switching

```bash
# Switch between dark and light themes
fosscode chat
# Type: /themes

# Or from command line
fosscode themes light
fosscode themes dark
```

### Configuration Management

```bash
# Set default preferences
fosscode config set defaultProvider grok
fosscode config set defaultModel grok-1
fosscode config set theme dark

# Configure provider-specific settings
fosscode config set providers.openai.timeout 60000
fosscode config set providers.grok.maxRetries 5

# View current configuration
cat ~/.config/fosscode/config.json
```

## Best Practices

### Performance Optimization

1. **Use appropriate models for tasks**
   - Fast models (grok-1, gpt-3.5-turbo) for quick questions
   - Advanced models (gpt-4, claude-3) for complex reasoning

2. **Manage conversation length**
   - Use `/compress` when conversations get long
   - Use `/clear` to start fresh sessions
   - Monitor memory with `/memory`

3. **Choose the right provider**
   - Grok for creative and helpful responses
   - OpenAI for technical and analytical tasks
   - MCP for tool-augmented workflows

### Security Considerations

1. **API Key Management**
   - Never share your API keys
   - Use environment variables for sensitive config
   - Regularly rotate API keys

2. **File Attachments**
   - Be cautious with sensitive files
   - Use file search to avoid exposing unwanted files
   - Consider privacy implications of file content

### Workflow Optimization

1. **Organize by task type**
   - Use different chat sessions for different projects
   - Leverage modes (code vs thinking) for specialized work
   - Use non-interactive mode for scripted tasks

2. **Leverage MCP tools**
   - Configure useful MCP servers for your workflow
   - Combine AI capabilities with practical tools
   - Automate repetitive tasks with MCP integrations

## Troubleshooting Common Issues

### Connection Problems

```bash
# Test basic connectivity
fosscode chat "Hello" --non-interactive --provider grok

# Check configuration
fosscode config set providers.grok.timeout 30000

# Try different provider
fosscode chat "Hello" --non-interactive --provider openai
```

### Memory Issues

```bash
# Monitor memory usage
/memory

# Compress conversation
/compress

# Clear and restart
/clear

# Force cleanup
/gc
```

### MCP Server Issues

```bash
# Verify MCP configuration
fosscode config set providers.mcp.verbose true

# Test MCP connection
fosscode chat --provider mcp --verbose
# Type: "List available tools"

# Restart MCP server if needed
fosscode config set providers.mcp.mcpServerArgs '["@playwright/mcp@latest", "--restart"]'
```

This comprehensive guide covers the most common use cases and best practices for fosscode. Experiment with different combinations of providers, modes, and tools to find the workflow that works best for your needs!</content>
</xai:function_call">The file has been modified.
