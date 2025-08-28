import { describe, it, expect, beforeEach } from '@jest/globals';
import { PromptCacheManager } from '../utils/promptCache.js';
import { Message, ProviderType } from '../types/index.js';

describe('Prompt Cache Manager', () => {
  let cacheManager: PromptCacheManager;
  const testMessages: Message[] = [
    { role: 'user', content: 'Hello, how are you?', timestamp: new Date() },
  ];
  const testProvider: ProviderType = 'sonicfree';
  const testModel = 'sonic';

  beforeEach(() => {
    cacheManager = PromptCacheManager.getInstance();
    cacheManager.clearCache();
  });

  describe('Basic Caching', () => {
    it('should cache and retrieve responses', () => {
      const response = 'Hello! I am doing well, thank you for asking.';

      cacheManager.cacheResponse(testMessages, response, testProvider, testModel, 50);
      const cached = cacheManager.getCachedResponse(testMessages, testProvider, testModel);

      expect(cached).toBe(response);
    });

    it('should return null for uncached prompts', () => {
      const uncachedMessages: Message[] = [
        { role: 'user', content: 'What is the weather?', timestamp: new Date() },
      ];

      const cached = cacheManager.getCachedResponse(uncachedMessages, testProvider, testModel);
      expect(cached).toBeNull();
    });

    it('should handle different providers separately', () => {
      const response1 = 'Response from SonicFree';
      const response2 = 'Response from OpenAI';

      cacheManager.cacheResponse(testMessages, response1, 'sonicfree', testModel, 50);
      cacheManager.cacheResponse(testMessages, response2, 'openai', testModel, 50);

      expect(cacheManager.getCachedResponse(testMessages, 'sonicfree', testModel)).toBe(response1);
      expect(cacheManager.getCachedResponse(testMessages, 'openai', testModel)).toBe(response2);
    });
  });

  describe('SonicFree Specific Behavior', () => {
    it('should handle SonicFree tool calling responses', () => {
      const toolResponse = `🤔 **Iteration 1 - LLM Response:**
I need to help you with that request.

🔧 **Iteration 1 - Tool Calls:**
   • search_web (query: test query)

✅ **Final Response:**
Here are the results from your search...`;

      cacheManager.cacheResponse(testMessages, toolResponse, testProvider, testModel, 150);
      const cached = cacheManager.getCachedResponse(testMessages, testProvider, testModel);

      expect(cached).toBe(toolResponse);
    });

    it('should cache SonicFree simple responses', () => {
      const simpleResponse = 'Hello! This is a simple response from SonicFree.';

      cacheManager.cacheResponse(testMessages, simpleResponse, testProvider, testModel, 25);
      const cached = cacheManager.getCachedResponse(testMessages, testProvider, testModel);

      expect(cached).toBe(simpleResponse);
    });
  });
});
