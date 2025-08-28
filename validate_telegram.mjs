import fs from 'fs';
import path from 'path';
import os from 'os';

const configPath = path.join(os.homedir(), '.config', 'fosscode', 'config.json');

try {
  const configData = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(configData);

  console.log('✅ Config loaded successfully');

  if (config.messagingPlatforms?.telegram) {
    const telegram = config.messagingPlatforms.telegram;
    console.log('📱 Telegram Configuration:');
    console.log(`  - Enabled: ${telegram.enabled ? '✅' : '❌'}`);
    console.log(`  - Bot Token: ${telegram.botToken ? '✅ Set' : '❌ Missing'}`);
    console.log(`  - Bot Name: ${telegram.botName || 'Not set'}`);
    console.log(`  - Chat ID: ${telegram.chatId || 'Not set'}`);

    if (telegram.enabled && telegram.botToken) {
      console.log('\n🔧 Testing Telegram Bot Connection...');
      try {
        const { default: TelegramBot } = await import('node-telegram-bot-api');
        const bot = new TelegramBot(telegram.botToken, { polling: false });

        const botInfo = await bot.getMe();
        console.log('✅ Telegram Bot connected successfully!');
        console.log(`🤖 Bot: ${botInfo.first_name} (@${botInfo.username})`);

        if (telegram.chatId) {
          console.log('\n📤 Sending test message...');
          await bot.sendMessage(telegram.chatId, '🧪 Test message from fosscode validation');
          console.log('✅ Test message sent successfully!');
        } else {
          console.log('⚠️  No chatId - bot is configured but no test chat available');
        }
      } catch (error) {
        console.log('❌ Telegram test failed:', error.message);
      }
    }
  } else {
    console.log('❌ Telegram configuration not found in config');
  }
} catch (error) {
  console.log('❌ Error:', error.message);
}
