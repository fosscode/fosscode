import { BashTool } from '../../tools/BashTool.js';
import { performanceFramework } from './PerformanceTestFramework.js';

describe('BashTool Performance Tests', () => {
  let bashTool: BashTool;

  beforeEach(() => {
    bashTool = new BashTool();
  });

  describe('Command Execution Performance', () => {
    it('should execute simple commands quickly', async () => {
      const { result, metrics } = await performanceFramework.measurePerformance(
        'BashTool',
        'simpleCommand',
        async () => {
          return await bashTool.execute({
            command: 'echo "Hello World"',
            timeout: 5000,
          });
        },
        {
          maxExecutionTime: 1000, // 1 second
          maxMemoryDelta: 10 * 1024 * 1024, // 10MB
        }
      );

      expect(result.success).toBe(true);
      expect(metrics.executionTime).toBeLessThan(1000);
      expect(result.data.stdout).toContain('Hello World');
    });

    it('should handle command timeouts gracefully', async () => {
      const { result, metrics } = await performanceFramework.measurePerformance(
        'BashTool',
        'timeoutHandling',
        async () => {
          return await bashTool.execute({
            command: 'sleep 5',
            timeout: 1000, // 1 second timeout
          });
        },
        {
          maxExecutionTime: 2000, // Should timeout within 2 seconds
        }
      );

      expect(result.success).toBe(false);
      expect(metrics.executionTime).toBeLessThan(2000);
      expect(result.error).toContain('timeout');
    });

    it('should execute file system operations efficiently', async () => {
      const { result, metrics } = await performanceFramework.measurePerformance(
        'BashTool',
        'fileOperations',
        async () => {
          return await bashTool.execute({
            command: 'ls -la /tmp | head -20',
            timeout: 5000,
          });
        },
        {
          maxExecutionTime: 2000, // 2 seconds
          maxMemoryDelta: 20 * 1024 * 1024, // 20MB
        }
      );

      expect(result.success).toBe(true);
      expect(metrics.executionTime).toBeLessThan(2000);
      expect(result.data.stdout).toBeDefined();
    });
  });

  describe('Resource-Intensive Operations', () => {
    it('should handle CPU-intensive tasks with timeout', async () => {
      const { result, metrics } = await performanceFramework.measurePerformance(
        'BashTool',
        'cpuIntensive',
        async () => {
          return await bashTool.execute({
            command: 'dd if=/dev/zero bs=1M count=100 | md5sum', // Generate 100MB of data
            timeout: 10000,
          });
        },
        {
          maxExecutionTime: 8000, // 8 seconds
          maxMemoryDelta: 150 * 1024 * 1024, // 150MB
        }
      );

      expect(result.success).toBe(true);
      expect(metrics.executionTime).toBeLessThan(8000);
      expect(result.data.stdout).toBeDefined();
    });

    it('should handle large output efficiently', async () => {
      const { result, metrics } = await performanceFramework.measurePerformance(
        'BashTool',
        'largeOutput',
        async () => {
          return await bashTool.execute({
            command: 'find /usr -name "*.so" 2>/dev/null | head -1000', // Large output
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
      expect(result.data.stdout).toBeDefined();
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle command not found errors quickly', async () => {
      const { result, metrics } = await performanceFramework.measurePerformance(
        'BashTool',
        'commandNotFound',
        async () => {
          return await bashTool.execute({
            command: 'nonexistentcommand12345',
            timeout: 5000,
          });
        },
        {
          maxExecutionTime: 500, // Should fail quickly
        }
      );

      expect(result.success).toBe(false);
      expect(metrics.executionTime).toBeLessThan(500);
      expect(result.error).toBeDefined();
    });

    it('should handle permission denied errors', async () => {
      const { result, metrics } = await performanceFramework.measurePerformance(
        'BashTool',
        'permissionDenied',
        async () => {
          return await bashTool.execute({
            command: 'cat /etc/shadow', // Requires root
            timeout: 5000,
          });
        },
        {
          maxExecutionTime: 1000, // Should fail quickly
        }
      );

      expect(result.success).toBe(false);
      expect(metrics.executionTime).toBeLessThan(1000);
      expect(result.error).toBeDefined();
    });

    it('should handle invalid shell syntax', async () => {
      const { result, metrics } = await performanceFramework.measurePerformance(
        'BashTool',
        'invalidSyntax',
        async () => {
          return await bashTool.execute({
            command: 'if [; then echo "broken"; fi',
            timeout: 5000,
          });
        },
        {
          maxExecutionTime: 500, // Should fail quickly
        }
      );

      expect(result.success).toBe(false);
      expect(metrics.executionTime).toBeLessThan(500);
      expect(result.error).toBeDefined();
    });
  });

  describe('Complex Command Chains', () => {
    it('should handle complex command pipelines efficiently', async () => {
      const { result, metrics } = await performanceFramework.measurePerformance(
        'BashTool',
        'complexPipeline',
        async () => {
          return await bashTool.execute({
            command: "ps aux | grep node | sort -k3 -n | tail -10 | awk '{print $2, $11}'",
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
      expect(result.data.stdout).toBeDefined();
    });

    it('should handle background processes correctly', async () => {
      const { result, metrics } = await performanceFramework.measurePerformance(
        'BashTool',
        'backgroundProcess',
        async () => {
          return await bashTool.execute({
            command: 'sleep 2 & echo "Background started" && wait',
            timeout: 5000,
          });
        },
        {
          maxExecutionTime: 4000, // 4 seconds
          maxMemoryDelta: 20 * 1024 * 1024, // 20MB
        }
      );

      expect(result.success).toBe(true);
      expect(metrics.executionTime).toBeLessThan(4000);
      expect(result.data.stdout).toContain('Background started');
    });
  });
});
