# Messaging Platforms Integration

fosscode supports integration with various messaging platforms to enable conversational AI interactions outside of the terminal interface. This feature allows users to interact with fosscode through Telegram, Discord, Slack, and other messaging platforms.

## Supported Platforms

- **Telegram** - Bot-based integration
- **Discord** - Bot-based integration (planned)
- **Slack** - Bot-based integration (planned)
- **Terminal** - Default terminal interface (always enabled)

## Quick Start

### 1. Install Dependencies

For Telegram support, install the required dependency:

```bash
npm install node-telegram-bot-api
```

### 2. Configure Your Messaging Platform

Update your `config.json` file to enable and configure the desired messaging platform:

```json
{
  "messagingPlatforms": {
    "telegram": {
      "enabled": true,
      "botToken": "your-telegram-bot-token-here",
      "timeout": 30000,
      "maxRetries": 3,
      "verbose": false
    }
  }
}
```

### 3. Start fosscode with Messaging Platform

Use the `--messaging-platform` flag to start fosscode with a specific messaging platform:

```bash
# Start with Telegram
fosscode chat --messaging-platform telegram --provider openai --model gpt-3.5-turbo

# Start with verbose logging
fosscode chat --messaging-platform telegram --provider openai --model gpt-3.5-turbo --verbose
```

## Platform-Specific Setup

### Telegram Setup

1. **Create a Telegram Bot**:
   - Message [@BotFather](https://t.me/botfather) on Telegram
   - Use `/newbot` command and follow the instructions
   - Copy the bot token provided

2. **Configure fosscode**:

   ```json
   {
     "messagingPlatforms": {
       "telegram": {
         "enabled": true,
         "botToken": "YOUR_BOT_TOKEN_HERE"
       }
     }
   }
   ```

3. **Start the bot**:

   ```bash
   fosscode chat --messaging-platform telegram
   ```

4. **Interact with your bot**:
   - Find your bot on Telegram using the username provided by BotFather
   - Start a conversation by sending `/start` or any message
   - The bot will respond using the configured AI provider

### Discord Setup (Planned)

```json
{
  "messagingPlatforms": {
    "discord": {
      "enabled": true,
      "botToken": "your-discord-bot-token-here"
    }
  }
}
```

### Slack Setup (Planned)

```json
{
  "messagingPlatforms": {
    "slack": {
      "enabled": true,
      "botToken": "your-slack-bot-token-here"
    }
  }
}
```

## Configuration Options

Each messaging platform supports the following configuration options:

- `enabled` (boolean): Whether the platform is enabled
- `botToken` (string): Authentication token for the bot
- `timeout` (number): Request timeout in milliseconds (default: 30000)
- `maxRetries` (number): Maximum number of retry attempts (default: 3)
- `verbose` (boolean): Enable verbose logging (default: false)

## Usage Examples

### Basic Usage

```bash
# Use Telegram with default provider and model
fosscode chat --messaging-platform telegram

# Use Telegram with specific provider and model
fosscode chat --messaging-platform telegram --provider anthropic --model claude-3-sonnet-20240229

# Use with verbose output
fosscode chat --messaging-platform telegram --verbose
```

### Advanced Usage

```bash
# Use non-interactive mode with messaging platform (for automation)
echo "Hello, how are you?" | fosscode chat --messaging-platform telegram --non-interactive

# Combine with other fosscode features
fosscode chat --messaging-platform telegram --provider openai --model gpt-4 --verbose
```

## Architecture

The messaging platform integration is built with an extensible architecture:

### Core Components

1. **MessagingPlatform Interface**: Defines the contract for all messaging platforms
2. **MessagingPlatformManager**: Manages platform registration and lifecycle
3. **Platform Adapters**: Platform-specific implementations (TelegramPlatform, etc.)
4. **ChatCommand Integration**: Extended to support messaging platforms

### Adding New Platforms

To add support for a new messaging platform:

1. **Create a Platform Adapter**:

   ```typescript
   import {
     MessagingPlatform,
     MessagingPlatformType,
     MessagingPlatformConfig,
   } from '../types/index.js';

   export class MyPlatform implements MessagingPlatform {
     getPlatformType(): MessagingPlatformType {
       return 'myplatform';
     }

     async initialize(config: MessagingPlatformConfig): Promise<void> {
       // Initialize your platform
     }

     async sendMessage(chatId: string, message: string): Promise<MessagingPlatformResponse> {
       // Send message implementation
     }

     async listenForMessages(
       callback: (message: MessagingPlatformMessage) => Promise<void>
     ): Promise<void> {
       // Listen for messages implementation
     }

     async stopListening(): Promise<void> {
       // Cleanup implementation
     }

     async validateConfig(config: MessagingPlatformConfig): Promise<boolean> {
       // Validate configuration
     }
   }
   ```

2. **Register the Platform**:

   ```typescript
   // In ChatCommand constructor
   this.messagingManager.registerPlatform(new MyPlatform());
   ```

3. **Add Configuration**:
   ```json
   {
     "messagingPlatforms": {
       "myplatform": {
         "enabled": false,
         "botToken": "your-token"
       }
     }
   }
   ```

## Security Considerations

- **Bot Tokens**: Store bot tokens securely and never commit them to version control
- **Rate Limiting**: Implement appropriate rate limiting to prevent abuse
- **Input Validation**: Validate all incoming messages before processing
- **Error Handling**: Implement proper error handling to prevent information leakage

## Troubleshooting

### Common Issues

1. **"Platform not enabled" error**:
   - Ensure the platform is enabled in your `config.json`
   - Check that the configuration is valid

2. **"Bot token required" error**:
   - Verify your bot token is correctly set in the configuration
   - Ensure the token has the necessary permissions

3. **Connection issues**:
   - Check your internet connection
   - Verify the bot token is valid and active
   - Check platform-specific API status

4. **Messages not received**:
   - Ensure the bot is running and connected
   - Check that users have started a conversation with the bot
   - Verify the bot has permission to send messages

### Debug Mode

Enable verbose logging for detailed debugging:

```bash
fosscode chat --messaging-platform telegram --verbose
```

## Future Enhancements

- **Webhooks**: Support for webhook-based integrations
- **Multi-platform**: Support for multiple platforms simultaneously
- **Rich Messages**: Support for rich text, images, and interactive elements
- **User Management**: User authentication and session management
- **Message History**: Persistent message history across sessions
