import { EventEmitter } from 'events';
import {
  BackgroundTask,
  BackgroundTaskConfig,
  BackgroundTaskPriority,
  BackgroundTaskOutput,
  SubagentConfig,
  ProviderType,
  Message,
} from '../types/index.js';
import { TaskQueue, taskQueue } from './TaskQueue.js';
import { ProviderManager } from '../providers/ProviderManager.js';
import { ConfigManager } from '../config/ConfigManager.js';
import pc from 'picocolors';

/**
 * Subagent represents a spawned agent for handling complex tasks
 */
export interface Subagent {
  id: string;
  config: SubagentConfig;
  taskId: string;
  messages: Message[];
  createdAt: Date;
  status: 'active' | 'completed' | 'failed';
}

/**
 * BackgroundTaskManager orchestrates background task execution,
 * subagent spawning, and task monitoring.
 */
export class BackgroundTaskManager extends EventEmitter {
  private taskQueue: TaskQueue;
  private providerManager: ProviderManager | null = null;
  private configManager: ConfigManager;
  private subagents: Map<string, Subagent> = new Map();
  private taskExecutors: Map<string, (task: BackgroundTask) => Promise<any>> = new Map();
  private outputSubscribers: Map<string, Set<(output: BackgroundTaskOutput) => void>> = new Map();

  constructor(queue?: TaskQueue) {
    super();
    this.taskQueue = queue || taskQueue;
    this.configManager = new ConfigManager();
    this.setupQueueListeners();
  }

  /**
   * Initialize with a provider manager
   */
  initialize(providerManager: ProviderManager): void {
    this.providerManager = providerManager;
  }

  /**
   * Set up event listeners for the task queue
   */
  private setupQueueListeners(): void {
    this.taskQueue.on('processTask', async (task: BackgroundTask) => {
      await this.executeTask(task);
    });

    this.taskQueue.on('taskCompleted', (task: BackgroundTask) => {
      this.emit('taskCompleted', task);

      if (task.config.verbose) {
        console.log(pc.green(`✅ Task completed: ${task.name}`));
      }
    });

    this.taskQueue.on('taskFailed', (task: BackgroundTask, error: string) => {
      this.emit('taskFailed', task, error);

      if (task.config.verbose) {
        console.log(pc.red(`❌ Task failed: ${task.name} - ${error}`));
      }
    });

    this.taskQueue.on('taskOutput', (task: BackgroundTask, output: BackgroundTaskOutput) => {
      this.notifyOutputSubscribers(task.id, output);
    });
  }

  /**
   * Create a new background task
   */
  createTask(
    name: string,
    description: string,
    executor: (task: BackgroundTask) => Promise<any>,
    options: {
      provider?: ProviderType;
      model?: string;
      priority?: BackgroundTaskPriority;
      verbose?: boolean;
      timeout?: number;
      maxRetries?: number;
      parentTaskId?: string;
    } = {}
  ): BackgroundTask {
    const config = this.configManager.getConfig();

    const taskConfig: BackgroundTaskConfig = {
      provider: options.provider || (config.defaultProvider as ProviderType),
      model: options.model || config.defaultModel,
      ...(options.verbose !== undefined
        ? { verbose: options.verbose }
        : config.verbose !== undefined
          ? { verbose: config.verbose }
          : {}),
      ...(options.timeout !== undefined && { timeout: options.timeout }),
      ...(options.maxRetries !== undefined && { maxRetries: options.maxRetries }),
    };

    const task = this.taskQueue.addTask(
      name,
      description,
      taskConfig,
      options.priority || 'normal',
      options.parentTaskId
    );

    // Store the executor for this task
    this.taskExecutors.set(task.id, executor);

    return task;
  }

  /**
   * Create a simple message-based task
   */
  createMessageTask(
    name: string,
    message: string,
    options: {
      provider?: ProviderType;
      model?: string;
      priority?: BackgroundTaskPriority;
      verbose?: boolean;
      timeout?: number;
      parentTaskId?: string;
    } = {}
  ): BackgroundTask {
    return this.createTask(
      name,
      message,
      async (task) => {
        if (!this.providerManager) {
          throw new Error('Provider manager not initialized');
        }

        const messages: Message[] = [
          {
            role: 'user',
            content: message,
            timestamp: new Date(),
          },
        ];

        const response = await this.providerManager.sendMessage(
          task.config.provider,
          messages,
          task.config.model,
          task.config.verbose ?? false
        );

        return response.content;
      },
      options
    );
  }

  /**
   * Execute a task
   */
  private async executeTask(task: BackgroundTask): Promise<void> {
    const executor = this.taskExecutors.get(task.id);

    if (!executor) {
      this.taskQueue.failTask(task.id, 'No executor found for task');
      return;
    }

    try {
      // Set up timeout if configured
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      let timeoutPromise: Promise<never> | null = null;

      if (task.config.timeout) {
        timeoutPromise = new Promise((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new Error(`Task timed out after ${task.config.timeout}ms`));
          }, task.config.timeout);
        });
      }

      // Execute the task
      const executionPromise = executor(task);

      const result = await (timeoutPromise
        ? Promise.race([executionPromise, timeoutPromise])
        : executionPromise);

      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      // Clean up executor
      this.taskExecutors.delete(task.id);

      this.taskQueue.completeTask(task.id, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Clean up executor
      this.taskExecutors.delete(task.id);

      this.taskQueue.failTask(task.id, errorMessage);
    }
  }

  /**
   * Spawn a subagent for complex multi-step tasks
   */
  spawnSubagent(config: SubagentConfig, parentTaskId?: string): Subagent {
    const subagentId = `subagent_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Create a task for the subagent
    const taskOptions: {
      provider: ProviderType;
      model: string;
      timeout?: number;
      parentTaskId?: string;
    } = {
      provider: config.provider,
      model: config.model,
    };

    if (config.timeout !== undefined) {
      taskOptions.timeout = config.timeout;
    }

    if (parentTaskId !== undefined) {
      taskOptions.parentTaskId = parentTaskId;
    }

    const task = this.createTask(
      `Subagent: ${config.name}`,
      config.description,
      async (t) => {
        return this.runSubagent(subagentId, t);
      },
      taskOptions
    );

    const subagent: Subagent = {
      id: subagentId,
      config,
      taskId: task.id,
      messages: [
        {
          role: 'system',
          content: config.instructions,
          timestamp: new Date(),
        },
      ],
      createdAt: new Date(),
      status: 'active',
    };

    this.subagents.set(subagentId, subagent);
    this.emit('subagentSpawned', subagent);

    return subagent;
  }

  /**
   * Run a subagent to completion
   */
  private async runSubagent(subagentId: string, task: BackgroundTask): Promise<string> {
    const subagent = this.subagents.get(subagentId);
    if (!subagent) {
      throw new Error(`Subagent ${subagentId} not found`);
    }

    if (!this.providerManager) {
      throw new Error('Provider manager not initialized');
    }

    try {
      // Add initial user message
      subagent.messages.push({
        role: 'user',
        content: subagent.config.description,
        timestamp: new Date(),
      });

      this.taskQueue.addTaskOutput(task.id, 'progress', 'Subagent started processing...');

      const response = await this.providerManager.sendMessage(
        subagent.config.provider,
        subagent.messages,
        subagent.config.model,
        false
      );

      subagent.messages.push({
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
      });

      subagent.status = 'completed';
      this.emit('subagentCompleted', subagent);

      this.taskQueue.addTaskOutput(task.id, 'result', response.content);

      return response.content;
    } catch (error) {
      subagent.status = 'failed';
      this.emit('subagentFailed', subagent, error);
      throw error;
    }
  }

  /**
   * Send a message to an active subagent
   */
  async sendToSubagent(subagentId: string, message: string): Promise<string> {
    const subagent = this.subagents.get(subagentId);
    if (!subagent) {
      throw new Error(`Subagent ${subagentId} not found`);
    }

    if (subagent.status !== 'active') {
      throw new Error(`Subagent ${subagentId} is not active`);
    }

    if (!this.providerManager) {
      throw new Error('Provider manager not initialized');
    }

    subagent.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
    });

    const response = await this.providerManager.sendMessage(
      subagent.config.provider,
      subagent.messages,
      subagent.config.model,
      false
    );

    subagent.messages.push({
      role: 'assistant',
      content: response.content,
      timestamp: new Date(),
    });

    return response.content;
  }

  /**
   * Get a subagent by ID
   */
  getSubagent(subagentId: string): Subagent | undefined {
    return this.subagents.get(subagentId);
  }

  /**
   * Get all active subagents
   */
  getActiveSubagents(): Subagent[] {
    return Array.from(this.subagents.values()).filter(s => s.status === 'active');
  }

  /**
   * Terminate a subagent
   */
  terminateSubagent(subagentId: string): boolean {
    const subagent = this.subagents.get(subagentId);
    if (!subagent) return false;

    // Cancel the associated task
    this.taskQueue.cancelTask(subagent.taskId);

    subagent.status = 'completed';
    this.emit('subagentTerminated', subagent);

    return true;
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): BackgroundTask | undefined {
    return this.taskQueue.getTask(taskId);
  }

  /**
   * Get all running tasks
   */
  getRunningTasks(): BackgroundTask[] {
    return this.taskQueue.getTasksByStatus('running');
  }

  /**
   * Get all queued tasks
   */
  getQueuedTasks(): BackgroundTask[] {
    return this.taskQueue.getTasksByStatus('queued');
  }

  /**
   * Get completed tasks
   */
  getCompletedTasks(): BackgroundTask[] {
    return this.taskQueue.getTasksByStatus('completed');
  }

  /**
   * Get failed tasks
   */
  getFailedTasks(): BackgroundTask[] {
    return this.taskQueue.getTasksByStatus('failed');
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): boolean {
    return this.taskQueue.cancelTask(taskId);
  }

  /**
   * Update task progress
   */
  updateProgress(taskId: string, progress: number): boolean {
    return this.taskQueue.updateProgress(taskId, progress);
  }

  /**
   * Add output to a task
   */
  addOutput(taskId: string, type: BackgroundTaskOutput['type'], content: string): boolean {
    return this.taskQueue.addTaskOutput(taskId, type, content);
  }

  /**
   * Get task output
   */
  getTaskOutput(taskId: string): BackgroundTaskOutput[] {
    return this.taskQueue.getTaskOutput(taskId);
  }

  /**
   * Subscribe to task output stream
   */
  subscribeToOutput(
    taskId: string,
    callback: (output: BackgroundTaskOutput) => void
  ): () => void {
    // Add to local subscribers
    if (!this.outputSubscribers.has(taskId)) {
      this.outputSubscribers.set(taskId, new Set());
    }
    this.outputSubscribers.get(taskId)!.add(callback);

    // Also subscribe to queue events
    const unsubscribe = this.taskQueue.subscribeToTaskOutput(taskId, callback);

    return () => {
      this.outputSubscribers.get(taskId)?.delete(callback);
      unsubscribe();
    };
  }

  /**
   * Notify output subscribers
   */
  private notifyOutputSubscribers(taskId: string, output: BackgroundTaskOutput): void {
    const subscribers = this.outputSubscribers.get(taskId);
    if (subscribers) {
      for (const callback of subscribers) {
        try {
          callback(output);
        } catch (error) {
          console.error('Error in output subscriber:', error);
        }
      }
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return this.taskQueue.getStats();
  }

  /**
   * Get queue state
   */
  getQueueState() {
    return this.taskQueue.getState();
  }

  /**
   * Set maximum concurrent tasks
   */
  setMaxConcurrent(max: number): void {
    this.taskQueue.setMaxConcurrent(max);
  }

  /**
   * Clear all queued tasks
   */
  clearQueue(): number {
    return this.taskQueue.clearQueue();
  }

  /**
   * Clear completed task history
   */
  clearHistory(): number {
    return this.taskQueue.clearHistory();
  }

  /**
   * Format task for display
   */
  formatTaskDisplay(task: BackgroundTask): string {
    const statusIcons: Record<string, string> = {
      queued: '⏳',
      running: '▶️',
      completed: '✅',
      failed: '❌',
      cancelled: '🚫',
    };

    const priorityLabels: Record<string, string> = {
      high: '[HIGH]',
      normal: '',
      low: '[LOW]',
    };

    const icon = statusIcons[task.status] || '❓';
    const priority = priorityLabels[task.priority] || '';
    const duration = task.completedAt && task.startedAt
      ? ` (${Math.round((task.completedAt.getTime() - task.startedAt.getTime()) / 1000)}s)`
      : '';

    let output = `${icon} ${priority ? priority + ' ' : ''}${task.name}${duration}`;

    if (task.status === 'running' && task.progress > 0) {
      output += ` [${task.progress}%]`;
    }

    if (task.status === 'failed' && task.error) {
      output += `\n   Error: ${task.error}`;
    }

    return output;
  }

  /**
   * Get formatted task list for display
   */
  getTaskListDisplay(): string {
    const running = this.getRunningTasks();
    const queued = this.getQueuedTasks();
    const completed = this.getCompletedTasks().slice(0, 5);
    const failed = this.getFailedTasks().slice(0, 5);

    let output = '';

    if (running.length > 0) {
      output += '**Running Tasks:**\n';
      output += running.map(t => this.formatTaskDisplay(t)).join('\n');
      output += '\n\n';
    }

    if (queued.length > 0) {
      output += '**Queued Tasks:**\n';
      output += queued.map(t => this.formatTaskDisplay(t)).join('\n');
      output += '\n\n';
    }

    if (completed.length > 0) {
      output += '**Recently Completed:**\n';
      output += completed.map(t => this.formatTaskDisplay(t)).join('\n');
      output += '\n\n';
    }

    if (failed.length > 0) {
      output += '**Recent Failures:**\n';
      output += failed.map(t => this.formatTaskDisplay(t)).join('\n');
      output += '\n';
    }

    if (output === '') {
      output = 'No background tasks.';
    } else {
      const stats = this.getStats();
      output += `\n---\nQueue: ${stats.totalQueued} | Running: ${stats.totalRunning} | Completed: ${stats.totalCompleted} | Failed: ${stats.totalFailed}`;
    }

    return output;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.taskQueue.cleanup();
    this.subagents.clear();
    this.taskExecutors.clear();
    this.outputSubscribers.clear();
    this.removeAllListeners();
  }
}

// Export singleton instance
export const backgroundTaskManager = new BackgroundTaskManager();
