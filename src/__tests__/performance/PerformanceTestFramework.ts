/**
 * Performance Testing Framework for FOSSCODE Tools
 *
 * This framework provides utilities for measuring and benchmarking tool performance,
 * including execution time, memory usage, and resource consumption metrics.
 */

export interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: {
    before: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
    delta: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
      external: number;
    };
  };
  cpuUsage?: {
    user: number;
    system: number;
  };
  timestamp: Date;
}

export interface PerformanceTestResult {
  toolName: string;
  operation: string;
  metrics: PerformanceMetrics;
  success: boolean;
  error?: string;
}

export interface PerformanceThresholds {
  maxExecutionTime: number; // milliseconds
  maxMemoryDelta: number; // bytes
  warningThreshold: number; // percentage of max
}

export class PerformanceTestFramework {
  private static instance: PerformanceTestFramework;
  private results: PerformanceTestResult[] = [];

  private constructor() {}

  static getInstance(): PerformanceTestFramework {
    if (!PerformanceTestFramework.instance) {
      PerformanceTestFramework.instance = new PerformanceTestFramework();
    }
    return PerformanceTestFramework.instance;
  }

  /**
   * Measure performance of an async operation
   */
  async measurePerformance<T>(
    toolName: string,
    operation: string,
    operationFn: () => Promise<T>,
    thresholds?: Partial<PerformanceThresholds>
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    const startTime = process.hrtime.bigint();
    const memoryBefore = process.memoryUsage();
    const cpuUsageBefore = process.cpuUsage();

    try {
      const result = await operationFn();

      const endTime = process.hrtime.bigint();
      const memoryAfter = process.memoryUsage();
      const cpuUsageAfter = process.cpuUsage(cpuUsageBefore);

      const executionTime = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

      const metrics: PerformanceMetrics = {
        executionTime,
        memoryUsage: {
          before: memoryBefore,
          after: memoryAfter,
          delta: {
            rss: memoryAfter.rss - memoryBefore.rss,
            heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
            heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
            external: memoryAfter.external - memoryBefore.external,
          },
        },
        cpuUsage: {
          user: cpuUsageAfter.user / 1000, // Convert to milliseconds
          system: cpuUsageAfter.system / 1000,
        },
        timestamp: new Date(),
      };

      const testResult: PerformanceTestResult = {
        toolName,
        operation,
        metrics,
        success: true,
      };

      this.results.push(testResult);

      // Check thresholds if provided
      if (thresholds) {
        this.checkThresholds(testResult, thresholds);
      }

      return { result, metrics };
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1_000_000;

      const testResult: PerformanceTestResult = {
        toolName,
        operation,
        metrics: {
          executionTime,
          memoryUsage: {
            before: memoryBefore,
            after: process.memoryUsage(),
            delta: { rss: 0, heapUsed: 0, heapTotal: 0, external: 0 },
          },
          timestamp: new Date(),
        },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      this.results.push(testResult);
      throw error;
    }
  }

  /**
   * Check if performance metrics exceed thresholds
   */
  private checkThresholds(
    testResult: PerformanceTestResult,
    thresholds: Partial<PerformanceThresholds>
  ): void {
    const { metrics } = testResult;
    const warnings: string[] = [];

    if (thresholds.maxExecutionTime && metrics.executionTime > thresholds.maxExecutionTime) {
      const percentage = (metrics.executionTime / thresholds.maxExecutionTime) * 100;
      warnings.push(
        `Execution time exceeded threshold: ${metrics.executionTime.toFixed(2)}ms (${percentage.toFixed(1)}% of limit)`
      );
    }

    if (
      thresholds.maxMemoryDelta &&
      Math.abs(metrics.memoryUsage.delta.heapUsed) > thresholds.maxMemoryDelta
    ) {
      const deltaMB = metrics.memoryUsage.delta.heapUsed / (1024 * 1024);
      warnings.push(`Memory usage exceeded threshold: ${deltaMB.toFixed(2)}MB delta`);
    }

    if (warnings.length > 0) {
      console.warn(`⚠️  Performance warnings for ${testResult.toolName}.${testResult.operation}:`);
      warnings.forEach(warning => console.warn(`   ${warning}`));
    }
  }

  /**
   * Get all performance test results
   */
  getResults(): PerformanceTestResult[] {
    return [...this.results];
  }

  /**
   * Get results for a specific tool
   */
  getResultsForTool(toolName: string): PerformanceTestResult[] {
    return this.results.filter(result => result.toolName === toolName);
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const report: string[] = [];
    report.push('# Performance Test Report');
    report.push(`Generated: ${new Date().toISOString()}`);
    report.push('');

    if (this.results.length === 0) {
      report.push('No performance tests have been run.');
      return report.join('\n');
    }

    // Summary statistics
    const successfulTests = this.results.filter(r => r.success);
    const failedTests = this.results.filter(r => !r.success);

    report.push('## Summary');
    report.push(`- Total Tests: ${this.results.length}`);
    report.push(`- Successful: ${successfulTests.length}`);
    report.push(`- Failed: ${failedTests.length}`);
    report.push('');

    // Performance metrics summary
    const executionTimes = successfulTests.map(r => r.metrics.executionTime);
    const memoryDeltas = successfulTests.map(r => r.metrics.memoryUsage.delta.heapUsed);

    if (executionTimes.length > 0) {
      const avgExecutionTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
      const maxExecutionTime = Math.max(...executionTimes);
      const avgMemoryDelta = memoryDeltas.reduce((a, b) => a + b, 0) / memoryDeltas.length;
      const maxMemoryDelta = Math.max(...memoryDeltas.map(Math.abs));

      report.push('## Performance Metrics');
      report.push(`- Average Execution Time: ${avgExecutionTime.toFixed(2)}ms`);
      report.push(`- Maximum Execution Time: ${maxExecutionTime.toFixed(2)}ms`);
      report.push(`- Average Memory Delta: ${(avgMemoryDelta / (1024 * 1024)).toFixed(2)}MB`);
      report.push(`- Maximum Memory Delta: ${(maxMemoryDelta / (1024 * 1024)).toFixed(2)}MB`);
      report.push('');
    }

    // Detailed results
    report.push('## Detailed Results');
    for (const result of this.results) {
      const status = result.success ? '✅' : '❌';
      report.push(`### ${status} ${result.toolName}.${result.operation}`);

      if (result.success) {
        report.push(`- Execution Time: ${result.metrics.executionTime.toFixed(2)}ms`);
        report.push(
          `- Memory Delta: ${(result.metrics.memoryUsage.delta.heapUsed / (1024 * 1024)).toFixed(2)}MB`
        );
        if (result.metrics.cpuUsage) {
          report.push(`- CPU User: ${result.metrics.cpuUsage.user.toFixed(2)}ms`);
          report.push(`- CPU System: ${result.metrics.cpuUsage.system.toFixed(2)}ms`);
        }
      } else {
        report.push(`- Error: ${result.error}`);
      }
      report.push('');
    }

    return report.join('\n');
  }

  /**
   * Clear all results
   */
  clearResults(): void {
    this.results = [];
  }

  /**
   * Export results to JSON
   */
  exportResults(): string {
    return JSON.stringify(this.results, null, 2);
  }
}

// Export singleton instance
export const performanceFramework = PerformanceTestFramework.getInstance();
