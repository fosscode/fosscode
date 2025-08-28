export interface PoolConfig {
  maxRetries: number;
  retryDelay: number;
  requestTimeout: number;
}

/**
 * Simple retry manager for LLM provider requests
 */
export class ConnectionPool {
  private config: PoolConfig;

  constructor(config: Partial<PoolConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      requestTimeout: 30000,
      ...config,
    };
  }

  /**
   * Execute a request with retry logic and timeout
   */
  async executeWithRetry<T>(request: () => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Execute the request with timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), this.config.requestTimeout);
        });

        return await Promise.race([request(), timeoutPromise]);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt < this.config.maxRetries) {
          // Wait before retrying with exponential backoff
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }
}

// Export singleton instance
export const connectionPool = new ConnectionPool();
