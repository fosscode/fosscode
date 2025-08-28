import { MessagingPlatformManager } from '../messaging/MessagingPlatformManager.js';
import { TelegramPlatform } from '../messaging/platforms/TelegramPlatform.js';
import { MessagingPlatformType } from '../types/index.js';

describe('MessagingPlatform', () => {
  let manager: MessagingPlatformManager;

  beforeEach(() => {
    manager = new MessagingPlatformManager();
  });

  describe('Platform Registration', () => {
    it('should register and retrieve platforms', () => {
      const telegramPlatform = new TelegramPlatform();
      manager.registerPlatform(telegramPlatform);

      expect(manager.getPlatform('telegram')).toBe(telegramPlatform);
      expect(manager.getAvailablePlatforms()).toContain('telegram');
    });

    it('should unregister platforms', () => {
      const telegramPlatform = new TelegramPlatform();
      manager.registerPlatform(telegramPlatform);

      expect(manager.getPlatform('telegram')).toBe(telegramPlatform);

      manager.unregisterPlatform('telegram');

      expect(manager.getPlatform('telegram')).toBeUndefined();
      expect(manager.getAvailablePlatforms()).not.toContain('telegram');
    });
  });

  describe('Platform Validation', () => {
    it('should validate platform config', async () => {
      const telegramPlatform = new TelegramPlatform();
      manager.registerPlatform(telegramPlatform);

      // Test with disabled platform (should pass)
      const disabledConfig = { enabled: false };
      const isValid = await manager.validatePlatformConfig('telegram', disabledConfig);
      expect(isValid).toBe(true);
    });

    it('should handle non-existent platforms', async () => {
      await expect(
        manager.validatePlatformConfig('nonexistent' as MessagingPlatformType, { enabled: true })
      ).rejects.toThrow('Messaging platform nonexistent is not registered');
    });
  });

  describe('Platform Activity', () => {
    it('should track platform activity', () => {
      expect(manager.isPlatformActive('telegram')).toBe(false);
    });
  });
});
