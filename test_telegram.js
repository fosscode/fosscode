import fs from 'fs';
import path from 'path';
import os from 'os';

// Read the config
const configPath = path.join(os.homedir(), '.config', 'fosscode', 'config.json');

try {
  const configData = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(configData);

  console.log('✅ Config loaded successfully');
  console.log('📱 Telegram Configuration:');

  if (config.messagingPlatforms && config.messagingPlatforms.telegram) {
    const telegram = config.messagingPlatforms.telegram;
    console.log(`  - Enabled: ${telegram.enabled}`);
    console.log(`  - Bot Token: ${telegram.botToken ? '✅ Set' : '❌ Missing'}`);
    console.log(`  - Bot Name: ${telegram.botName || 'Not set'}`);
    console.log(`  - Chat ID: ${telegram.chatId || 'Not set'}`);
    console.log(`  - Timeout: ${telegram.timeout}ms`);
    console.log(`  - Max Retries: ${telegram.maxRetries}`);
    console.log(`  - Verbose: ${telegram.verbose}`);
  } else {
    console.log('❌ Telegram configuration not found');
  }

  // Test Telegram bot initialization (if node-telegram-bot-api is available)
  if (config.messagingPlatforms.telegram.enabled && config.messagingPlatforms.telegram.botToken) {
    console.log('\n🔧 Testing Telegram Bot Connection...');

    try {
      const { default: TelegramBot } = await import('node-telegram-bot-api');
      const bot = new TelegramBot(config.messagingPlatforms.telegram.botToken, { polling: false });

      bot
        .getMe()
        .then(botInfo => {
          console.log('✅ Telegram Bot connected successfully!');
          console.log(`🤖 Bot Info: ${botInfo.first_name} (@${botInfo.username})`);
          console.log(`🆔 Bot ID: ${botInfo.id}`);

          // Test sending a message if chatId is provided
          if (config.messagingPlatforms.telegram.chatId) {
            console.log('\n📤 Testing message send...');
            bot
              .sendMessage(
                config.messagingPlatforms.telegram.chatId,
                '🧪 Test message from fosscode configuration test'
              )
              .then(() => {
                console.log('✅ Test message sent successfully!');
              })
              .catch(error => {
                console.log('❌ Failed to send test message:', error.message);
              });
          } else {
            console.log('⚠️  No chatId configured - skipping message test');
          }
        })
        .catch(error => {
          console.log('❌ Failed to connect to Telegram Bot:', error.message);
        });
    } catch (error) {
      console.log(
        '❌ node-telegram-bot-api not installed. Install with: npm install node-telegram-bot-api'
      );
    }
  }
} catch (error) {
  console.log('❌ Error reading config:', error.message);
  console.log(
    '💡 Make sure to copy the updated config: cp updated_config.json ~/.config/fosscode/config.json'
  );
}
