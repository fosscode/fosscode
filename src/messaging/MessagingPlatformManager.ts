import {
  MessagingPlatform,
  MessagingPlatformType,
  MessagingPlatformConfig,
  MessagingPlatformMessage,
  MessagingPlatformResponse,
} from '../types/index.js';

export class MessagingPlatformManager {
  private platforms: Map<MessagingPlatformType, MessagingPlatform> = new Map();
  private activeListeners: Map<MessagingPlatformType, boolean> = new Map();

  registerPlatform(platform: MessagingPlatform): void {
    this.platforms.set(platform.getPlatformType(), platform);
  }

  unregisterPlatform(platformType: MessagingPlatformType): void {
    const platform = this.platforms.get(platformType);
    if (platform && this.activeListeners.get(platformType)) {
      platform.stopListening();
      this.activeListeners.set(platformType, false);
    }
    this.platforms.delete(platformType);
  }

  async initializePlatform(
    platformType: MessagingPlatformType,
    config: MessagingPlatformConfig
  ): Promise<void> {
    const platform = this.platforms.get(platformType);
    if (!platform) {
      throw new Error(`Messaging platform ${platformType} is not registered`);
    }

    if (!config.enabled) {
      throw new Error(`Messaging platform ${platformType} is not enabled in configuration`);
    }

    await platform.initialize(config);
  }

  async startListening(
    platformType: MessagingPlatformType,
    config: MessagingPlatformConfig,
    messageCallback: (message: MessagingPlatformMessage) => Promise<void>
  ): Promise<void> {
    const platform = this.platforms.get(platformType);
    if (!platform) {
      throw new Error(`Messaging platform ${platformType} is not registered`);
    }

    if (!config.enabled) {
      throw new Error(`Messaging platform ${platformType} is not enabled in configuration`);
    }

    await platform.initialize(config);
    await platform.listenForMessages(messageCallback);
    this.activeListeners.set(platformType, true);
  }

  async stopListening(platformType: MessagingPlatformType): Promise<void> {
    const platform = this.platforms.get(platformType);
    if (platform && this.activeListeners.get(platformType)) {
      await platform.stopListening();
      this.activeListeners.set(platformType, false);
    }
  }

  async sendMessage(
    platformType: MessagingPlatformType,
    chatId: string,
    message: string
  ): Promise<MessagingPlatformResponse> {
    const platform = this.platforms.get(platformType);
    if (!platform) {
      throw new Error(`Messaging platform ${platformType} is not registered`);
    }

    return await platform.sendMessage(chatId, message);
  }

  async validatePlatformConfig(
    platformType: MessagingPlatformType,
    config: MessagingPlatformConfig
  ): Promise<boolean> {
    const platform = this.platforms.get(platformType);
    if (!platform) {
      throw new Error(`Messaging platform ${platformType} is not registered`);
    }

    return await platform.validateConfig(config);
  }

  getAvailablePlatforms(): MessagingPlatformType[] {
    return Array.from(this.platforms.keys());
  }

  getPlatform(platformType: MessagingPlatformType): MessagingPlatform | undefined {
    return this.platforms.get(platformType);
  }

  isPlatformActive(platformType: MessagingPlatformType): boolean {
    return this.activeListeners.get(platformType) ?? false;
  }

  async stopAllListeners(): Promise<void> {
    for (const [platformType, isActive] of this.activeListeners) {
      if (isActive) {
        await this.stopListening(platformType);
      }
    }
  }
}
