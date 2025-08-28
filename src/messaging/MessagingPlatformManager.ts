import { MessagingPlatformType, MessagingPlatformMessage } from '../types/index.js';
import { TelegramPlatform } from './platforms/TelegramPlatform.js';

export interface PlatformResponse {
  success: boolean;
  error?: string;
}

export class MessagingPlatformManager {
  private platforms: Map<MessagingPlatformType, any> = new Map();

  constructor() {
    // Register available platforms
    this.registerPlatform(new TelegramPlatform());
  }

  registerPlatform(platform: any): void {
    this.platforms.set(platform.getType(), platform);
  }

  unregisterPlatform(type: MessagingPlatformType): void {
    this.platforms.delete(type);
  }

  getPlatform(type: MessagingPlatformType): any {
    return this.platforms.get(type);
  }

  getAvailablePlatforms(): MessagingPlatformType[] {
    return Array.from(this.platforms.keys());
  }

  async validatePlatformConfig(type: MessagingPlatformType, config: any): Promise<boolean> {
    const platform = this.getPlatform(type);
    if (!platform) return false;
    return await platform.validateConfig(config);
  }

  async initializePlatform(type: MessagingPlatformType, config: any): Promise<void> {
    const platform = this.getPlatform(type);
    if (platform) {
      await platform.initialize(config);
    }
  }

  async startListening(
    type: MessagingPlatformType,
    config: any,
    messageHandler: (message: MessagingPlatformMessage) => Promise<void>
  ): Promise<void> {
    const platform = this.getPlatform(type);
    if (platform) {
      await platform.startListening(config, messageHandler);
    }
  }

  async stopAllListeners(): Promise<void> {
    for (const platform of this.platforms.values()) {
      if (platform.stopListening) {
        await platform.stopListening();
      }
    }
  }

  async sendMessage(
    type: MessagingPlatformType,
    chatId: string,
    message: string
  ): Promise<PlatformResponse> {
    const platform = this.getPlatform(type);
    if (!platform) {
      return { success: false, error: 'Platform not found' };
    }
    return await platform.sendMessage(chatId, message);
  }

  isPlatformActive(type: MessagingPlatformType): boolean {
    const platform = this.getPlatform(type);
    return platform && platform.isActive ? platform.isActive() : false;
  }
}
