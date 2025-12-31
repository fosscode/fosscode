import { EventEmitter } from 'events';
import {
  BackgroundTask,
  BackgroundTaskStatus,
  BackgroundTaskPriority,
  BackgroundTaskConfig,
  BackgroundTaskOutput,
  TaskQueueState,
  TaskQueueStats,
} from '../types/index.js';
import pc from 'picocolors';

/**
 * TaskQueue manages background task execution with priority-based scheduling
 * and concurrent task execution support.
 */
export class TaskQueue extends EventEmitter {
  private state: TaskQueueState;
  private readonly maxCompletedHistory: number;
  private processingPromise: Promise<void> | null = null;

  constructor(maxConcurrent: number = 3, maxCompletedHistory: number = 50) {
    super();
    this.maxCompletedHistory = maxCompletedHistory;
    this.state = {
      isProcessing: false,
      maxConcurrent,
      runningTasks: [],
      queuedTasks: [],
      completedTasks: [],
    };
  }

  /**
   * Generate a unique task ID
   */
  private generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Add a new task to the queue
   */
  addTask(
    name: string,
    description: string,
    config: BackgroundTaskConfig,
    priority: BackgroundTaskPriority = 'normal',
    parentTaskId?: string
  ): BackgroundTask {
    const task: BackgroundTask = {
      id: this.generateId(),
      name,
      description,
      status: 'queued',
      priority,
      config,
      ...(parentTaskId && { parentTaskId }),
      childTaskIds: [],
      createdAt: new Date(),
      output: [],
      progress: 0,
      retryCount: 0,
    };

    // If this is a child task, register it with the parent
    if (parentTaskId) {
      const parentTask = this.getTask(parentTaskId);
      if (parentTask) {
        parentTask.childTaskIds.push(task.id);
      }
    }

    // Insert task based on priority
    this.insertByPriority(task);

    this.emit('taskAdded', task);

    if (config.verbose) {
      console.log(pc.cyan(`📋 Task queued: ${name} (${task.id})`));
    }

    // Start processing if not already running
    this.startProcessing();

    return task;
  }

  /**
   * Insert task into queue based on priority
   */
  private insertByPriority(task: BackgroundTask): void {
    const priorityOrder: Record<BackgroundTaskPriority, number> = {
      high: 0,
      normal: 1,
      low: 2,
    };

    const insertIndex = this.state.queuedTasks.findIndex(
      t => priorityOrder[t.priority] > priorityOrder[task.priority]
    );

    if (insertIndex === -1) {
      this.state.queuedTasks.push(task);
    } else {
      this.state.queuedTasks.splice(insertIndex, 0, task);
    }
  }

  /**
   * Get a task by ID (searches all queues)
   */
  getTask(taskId: string): BackgroundTask | undefined {
    return (
      this.state.runningTasks.find(t => t.id === taskId) ||
      this.state.queuedTasks.find(t => t.id === taskId) ||
      this.state.completedTasks.find(t => t.id === taskId)
    );
  }

  /**
   * Get all tasks matching a status
   */
  getTasksByStatus(status: BackgroundTaskStatus): BackgroundTask[] {
    switch (status) {
      case 'running':
        return [...this.state.runningTasks];
      case 'queued':
        return [...this.state.queuedTasks];
      case 'completed':
      case 'failed':
      case 'cancelled':
        return this.state.completedTasks.filter(t => t.status === status);
      default:
        return [];
    }
  }

  /**
   * Get all child tasks of a parent task
   */
  getChildTasks(parentTaskId: string): BackgroundTask[] {
    const parentTask = this.getTask(parentTaskId);
    if (!parentTask) return [];

    return parentTask.childTaskIds
      .map(id => this.getTask(id))
      .filter((t): t is BackgroundTask => t !== undefined);
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): boolean {
    const task = this.getTask(taskId);
    if (!task) return false;

    if (task.status === 'queued') {
      const index = this.state.queuedTasks.findIndex(t => t.id === taskId);
      if (index !== -1) {
        this.state.queuedTasks.splice(index, 1);
        task.status = 'cancelled';
        task.completedAt = new Date();
        this.addToCompleted(task);
        this.emit('taskCancelled', task);
        return true;
      }
    }

    if (task.status === 'running') {
      task.status = 'cancelled';
      task.completedAt = new Date();
      const index = this.state.runningTasks.findIndex(t => t.id === taskId);
      if (index !== -1) {
        this.state.runningTasks.splice(index, 1);
        this.addToCompleted(task);
        this.emit('taskCancelled', task);
        return true;
      }
    }

    return false;
  }

  /**
   * Cancel all child tasks of a parent task
   */
  cancelChildTasks(parentTaskId: string): number {
    const childTasks = this.getChildTasks(parentTaskId);
    let cancelledCount = 0;

    for (const task of childTasks) {
      if (this.cancelTask(task.id)) {
        cancelledCount++;
      }
      // Recursively cancel children
      cancelledCount += this.cancelChildTasks(task.id);
    }

    return cancelledCount;
  }

  /**
   * Update task progress
   */
  updateProgress(taskId: string, progress: number): boolean {
    const task = this.getTask(taskId);
    if (!task || task.status !== 'running') return false;

    task.progress = Math.max(0, Math.min(100, progress));
    this.emit('taskProgress', task);
    return true;
  }

  /**
   * Add output to a task
   */
  addTaskOutput(
    taskId: string,
    type: BackgroundTaskOutput['type'],
    content: string
  ): boolean {
    const task = this.getTask(taskId);
    if (!task) return false;

    const output: BackgroundTaskOutput = {
      timestamp: new Date(),
      type,
      content,
    };

    task.output.push(output);
    this.emit('taskOutput', task, output);
    return true;
  }

  /**
   * Complete a task successfully
   */
  completeTask(taskId: string, result?: any): boolean {
    const task = this.state.runningTasks.find(t => t.id === taskId);
    if (!task) return false;

    task.status = 'completed';
    task.completedAt = new Date();
    task.progress = 100;
    task.result = result;

    const index = this.state.runningTasks.indexOf(task);
    if (index !== -1) {
      this.state.runningTasks.splice(index, 1);
    }

    this.addToCompleted(task);
    this.emit('taskCompleted', task);

    // Continue processing queue
    this.processNextTasks();

    return true;
  }

  /**
   * Fail a task
   */
  failTask(taskId: string, error: string): boolean {
    const task = this.state.runningTasks.find(t => t.id === taskId);
    if (!task) return false;

    // Check if we should retry
    const maxRetries = task.config.maxRetries ?? 0;
    if (task.retryCount < maxRetries) {
      task.retryCount++;
      task.status = 'queued';
      delete task.startedAt;

      const index = this.state.runningTasks.indexOf(task);
      if (index !== -1) {
        this.state.runningTasks.splice(index, 1);
      }

      // Re-queue with high priority for retry
      this.state.queuedTasks.unshift(task);
      this.emit('taskRetry', task, task.retryCount);

      if (task.config.verbose) {
        console.log(
          pc.yellow(`🔄 Retrying task: ${task.name} (attempt ${task.retryCount + 1}/${maxRetries + 1})`)
        );
      }

      return true;
    }

    task.status = 'failed';
    task.completedAt = new Date();
    task.error = error;

    const index = this.state.runningTasks.indexOf(task);
    if (index !== -1) {
      this.state.runningTasks.splice(index, 1);
    }

    this.addToCompleted(task);
    this.emit('taskFailed', task, error);

    // Continue processing queue
    this.processNextTasks();

    return true;
  }

  /**
   * Add task to completed list, maintaining max history
   */
  private addToCompleted(task: BackgroundTask): void {
    this.state.completedTasks.unshift(task);

    // Trim completed history
    if (this.state.completedTasks.length > this.maxCompletedHistory) {
      this.state.completedTasks = this.state.completedTasks.slice(
        0,
        this.maxCompletedHistory
      );
    }
  }

  /**
   * Start processing the queue
   */
  private startProcessing(): void {
    if (this.processingPromise) return;

    this.processingPromise = this.processQueue();
  }

  /**
   * Process the task queue
   */
  private async processQueue(): Promise<void> {
    this.state.isProcessing = true;

    while (this.state.queuedTasks.length > 0 || this.state.runningTasks.length > 0) {
      await this.processNextTasks();

      // Wait for any running task to complete
      if (this.state.runningTasks.length >= this.state.maxConcurrent) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.state.isProcessing = false;
    this.processingPromise = null;
    this.emit('queueEmpty');
  }

  /**
   * Process next available tasks up to max concurrent
   */
  private async processNextTasks(): Promise<void> {
    while (
      this.state.runningTasks.length < this.state.maxConcurrent &&
      this.state.queuedTasks.length > 0
    ) {
      const task = this.state.queuedTasks.shift();
      if (!task) break;

      task.status = 'running';
      task.startedAt = new Date();
      this.state.runningTasks.push(task);

      this.emit('taskStarted', task);

      if (task.config.verbose) {
        console.log(pc.green(`▶️  Task started: ${task.name} (${task.id})`));
      }

      // Emit event to process the task (async)
      this.emit('processTask', task);
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): TaskQueueStats {
    return {
      totalQueued: this.state.queuedTasks.length,
      totalRunning: this.state.runningTasks.length,
      totalCompleted: this.state.completedTasks.filter(t => t.status === 'completed').length,
      totalFailed: this.state.completedTasks.filter(t => t.status === 'failed').length,
      isProcessing: this.state.isProcessing,
    };
  }

  /**
   * Get current queue state
   */
  getState(): TaskQueueState {
    return {
      ...this.state,
      runningTasks: [...this.state.runningTasks],
      queuedTasks: [...this.state.queuedTasks],
      completedTasks: [...this.state.completedTasks],
    };
  }

  /**
   * Clear all queued tasks
   */
  clearQueue(): number {
    const count = this.state.queuedTasks.length;

    for (const task of this.state.queuedTasks) {
      task.status = 'cancelled';
      task.completedAt = new Date();
      this.addToCompleted(task);
    }

    this.state.queuedTasks = [];
    this.emit('queueCleared', count);
    return count;
  }

  /**
   * Clear completed task history
   */
  clearHistory(): number {
    const count = this.state.completedTasks.length;
    this.state.completedTasks = [];
    this.emit('historyCleared', count);
    return count;
  }

  /**
   * Set maximum concurrent tasks
   */
  setMaxConcurrent(max: number): void {
    this.state.maxConcurrent = Math.max(1, max);
    // Process any waiting tasks if we increased capacity
    this.processNextTasks();
  }

  /**
   * Get task output stream (returns all output for a task)
   */
  getTaskOutput(taskId: string): BackgroundTaskOutput[] {
    const task = this.getTask(taskId);
    if (!task) return [];
    return [...task.output];
  }

  /**
   * Subscribe to task output stream
   */
  subscribeToTaskOutput(
    taskId: string,
    callback: (output: BackgroundTaskOutput) => void
  ): () => void {
    const handler = (task: BackgroundTask, output: BackgroundTaskOutput) => {
      if (task.id === taskId) {
        callback(output);
      }
    };

    this.on('taskOutput', handler);

    return () => {
      this.off('taskOutput', handler);
    };
  }

  /**
   * Clean up event listeners
   */
  cleanup(): void {
    this.removeAllListeners();
  }
}

// Export singleton instance
export const taskQueue = new TaskQueue();
