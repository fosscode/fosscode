import { WebFetchTool } from '../../tools/WebFetchTool.js';
import { performanceFramework } from './PerformanceTestFramework.js';

describe('WebFetchTool Performance Tests', () => {
  let webFetchTool: WebFetchTool;

  beforeEach(() => {
    webFetchTool = new WebFetchTool();
  });

  describe('HTTP Request Performance', () => {
    it('should fetch a small webpage within performance thresholds', async () => {
      const { result, metrics } = await performanceFramework.measurePerformance(
        'WebFetchTool',
        'fetchSmallPage',
        async () => {
          return await webFetchTool.execute({
            url: 'https://httpbin.org/html',
            format: 'text',
            timeout: 10000,
          });
        },
        {
          maxExecutionTime: 5000, // 5 seconds
          maxMemoryDelta: 50 * 1024 * 1024, // 50MB
        }
      );

      expect(result.success).toBe(true);
      expect(metrics.executionTime).toBeLessThan(5000);
      expect(result.data).toBeDefined();
    });

    it('should handle timeout gracefully', async () => {
      const { result, metrics } = await performanceFramework.measurePerformance(
        'WebFetchTool',
        'handleTimeout',
        async () => {
          return await webFetchTool.execute({
            url: 'https://httpbin.org/delay/10', // 10 second delay
            format: 'text',
            timeout: 2000, // 2 second timeout
          });
        },
        {
          maxExecutionTime: 3000, // Should timeout within 3 seconds
        }
      );

      expect(result.success).toBe(false);
      expect(metrics.executionTime).toBeLessThan(3000);
    });

    it('should fetch and convert HTML to markdown efficiently', async () => {
      const { result, metrics } = await performanceFramework.measurePerformance(
        'WebFetchTool',
        'htmlToMarkdown',
        async () => {
          return await webFetchTool.execute({
            url: 'https://httpbin.org/html',
            format: 'markdown',
            timeout: 10000,
          });
        },
        {
          maxExecutionTime: 8000, // 8 seconds for HTML processing
          maxMemoryDelta: 100 * 1024 * 1024, // 100MB for HTML parsing
        }
      );

      expect(result.success).toBe(true);
      expect(metrics.executionTime).toBeLessThan(8000);
      expect(result.data).toContain('#'); // Should contain markdown headers
    });
  });

  describe('Large Content Handling', () => {
    it('should handle large HTML pages efficiently', async () => {
      const { result, metrics } = await performanceFramework.measurePerformance(
        'WebFetchTool',
        'largeContent',
        async () => {
          return await webFetchTool.execute({
            url: 'https://httpbin.org/stream/100', // Large content
            format: 'text',
            timeout: 15000,
          });
        },
        {
          maxExecutionTime: 12000, // 12 seconds
          maxMemoryDelta: 200 * 1024 * 1024, // 200MB
        }
      );

      expect(result.success).toBe(true);
      expect(metrics.executionTime).toBeLessThan(12000);
      expect(result.data).toBeDefined();
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle 404 errors quickly', async () => {
      const { result, metrics } = await performanceFramework.measurePerformance(
        'WebFetchTool',
        '404Error',
        async () => {
          return await webFetchTool.execute({
            url: 'https://httpbin.org/status/404',
            format: 'text',
            timeout: 5000,
          });
        },
        {
          maxExecutionTime: 2000, // Should fail quickly
        }
      );

      expect(result.success).toBe(false);
      expect(metrics.executionTime).toBeLessThan(2000);
    });

    it('should handle network errors gracefully', async () => {
      const { result, metrics } = await performanceFramework.measurePerformance(
        'WebFetchTool',
        'networkError',
        async () => {
          return await webFetchTool.execute({
            url: 'https://nonexistent-domain-that-does-not-exist.invalid',
            format: 'text',
            timeout: 5000,
          });
        },
        {
          maxExecutionTime: 1000, // Should fail quickly
        }
      );

      expect(result.success).toBe(false);
      expect(metrics.executionTime).toBeLessThan(1000);
    });
  });
});
