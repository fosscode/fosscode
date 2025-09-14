import { EventEmitter } from 'events';
import { QueuedMessage, MessageQueueState } from '../types/index.js';
import pc from 'picocolors';
import { cancellationManager } from './CancellationManager.js';

export class MessageQueue extends EventEmitter {
  private state: MessageQueueState;
  private processingPromise: Promise<void> | null = null;

  constructor() {
    super();
    this.state = {
      isProcessing: false,
      queue: [],
    };

    // Listen for cancellation events
    cancellationManager.on('cancelled', token => {
      if (token.level === 'full') {
        this.clearQueue();
        console.log(pc.red('🗑️  Message queue cleared due to full cancellation'));
      }
    });
  }

  /**
   * Add a message to the queue
   */
  addMessage(
    message: string,
    options: {
      provider?: string;
      model?: string;
      verbose?: boolean;
    }
  ): string {
    const queuedMessage: QueuedMessage = {
      id: this.generateId(),
      message,
      options,
      timestamp: new Date(),
      status: 'queued',
    };

    this.state.queue.push(queuedMessage);
    this.emit('messageAdded', queuedMessage);

    if (options.verbose) {
      console.log(
        pc.cyan(`📝 Message queued (${this.state.queue.length} in queue):`),
        message.substring(0, 50) + (message.length > 50 ? '...' : '')
      );
    }

    // Start processing if not already processing and there are listeners for processMessage
    if (!this.state.isProcessing && this.listeners('processMessage').length > 0) {
      this.processQueue();
    }

    return queuedMessage.id;
  }

  /**
   * Get the current queue state
   */
  getState(): MessageQueueState {
    return { ...this.state };
  }

  /**
   * Get all queued messages
   */
  getQueuedMessages(): QueuedMessage[] {
    return [...this.state.queue];
  }

  /**
   * Clear all queued messages
   */
  clearQueue(): void {
    this.state.queue = [];
    this.emit('queueCleared');
  }

  /**
   * Remove a specific message from the queue
   */
  removeMessage(messageId: string): boolean {
    const index = this.state.queue.findIndex(msg => msg.id === messageId);
    if (index !== -1) {
      const removed = this.state.queue.splice(index, 1)[0];
      this.emit('messageRemoved', removed);
      return true;
    }
    return false;
  }

  /**
   * Process the message queue
   */
  private async processQueue(): Promise<void> {
    if (this.processingPromise) {
      return this.processingPromise;
    }

    this.processingPromise = this.doProcessQueue();
    await this.processingPromise;
    this.processingPromise = null;
  }

  private async doProcessQueue(): Promise<void> {
    while (this.state.queue.length > 0) {
      // Check if cancellation was requested
      if (cancellationManager.shouldCancel()) {
        console.log(pc.yellow('\n🛑 Message queue processing cancelled'));
        break;
      }

      const message = this.state.queue.shift();
      if (!message) break;

      this.state.isProcessing = true;
      this.state.currentMessage = message;
      message.status = 'processing';

      this.emit('messageProcessing', message);

      try {
        // Emit event to let the chat command handle the actual message sending
        const response = await this.emitAsync('processMessage', message);

        message.status = 'completed';
        message.response = response as string;
        this.emit('messageCompleted', message);
      } catch (error) {
        message.status = 'failed';
        message.error = error instanceof Error ? error.message : 'Unknown error';
        this.emit('messageFailed', message);
      }
    }

    this.state.isProcessing = false;
    delete this.state.currentMessage;
    this.emit('queueEmpty');
  }

  /**
   * Generate a unique ID for messages
   */
  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Helper method to emit events that return promises
   */
  private emitAsync(event: string, ...args: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const listeners = this.listeners(event);

      if (listeners.length === 0) {
        resolve(undefined);
        return;
      }

      let completed = 0;
      let result: any;
      let hasError = false;

      const callback = (err: Error | null, res?: any) => {
        if (hasError) return; // Prevent multiple rejections

        completed++;
        if (err) {
          hasError = true;
          reject(err);
          return;
        }
        result = res;

        if (completed === listeners.length) {
          resolve(result);
        }
      };

      this.emit(event, ...args, callback);
    });
  }

  /**
   * Clean up all event listeners to prevent memory leaks
   */
  cleanup(): void {
    this.removeAllListeners();
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    totalQueued: number;
    isProcessing: boolean;
    currentMessageId?: string;
  } {
    const stats: {
      totalQueued: number;
      isProcessing: boolean;
      currentMessageId?: string;
    } = {
      totalQueued: this.state.queue.length,
      isProcessing: this.state.isProcessing,
    };

    if (this.state.currentMessage?.id) {
      stats.currentMessageId = this.state.currentMessage.id;
    }

    return stats;
  }
}
