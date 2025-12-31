import { BackgroundTaskManager } from '../../utils/BackgroundTaskManager';
import { TaskQueue } from '../../utils/TaskQueue';

describe('BackgroundTaskManager', () => {
  let manager: BackgroundTaskManager;
  let taskQueue: TaskQueue;

  beforeEach(() => {
    // Create queue with 0 max concurrent to prevent auto-processing
    taskQueue = new TaskQueue(0, 10);
    manager = new BackgroundTaskManager(taskQueue);
  });

  afterEach(() => {
    manager.cleanup();
    taskQueue.cleanup();
  });

  describe('constructor', () => {
    it('should create a BackgroundTaskManager instance', () => {
      expect(manager).toBeInstanceOf(BackgroundTaskManager);
    });

    it('should use provided task queue', () => {
      const customQueue = new TaskQueue(0, 20);
      const customManager = new BackgroundTaskManager(customQueue);
      expect(customManager.getStats()).toEqual(customQueue.getStats());
      customManager.cleanup();
      customQueue.cleanup();
    });
  });

  describe('createTask', () => {
    it('should create a new task with default options', () => {
      const executor = jest.fn().mockResolvedValue('result');
      const task = manager.createTask('Test Task', 'Test description', executor);

      expect(task).toBeDefined();
      expect(task.name).toBe('Test Task');
      expect(task.description).toBe('Test description');
      expect(task.status).toBe('queued');
      expect(task.priority).toBe('normal');
      expect(task.progress).toBe(0);
      expect(task.childTaskIds).toEqual([]);
    });

    it('should create a task with custom priority', () => {
      const executor = jest.fn().mockResolvedValue('result');
      const task = manager.createTask('High Priority Task', 'Description', executor, {
        priority: 'high',
      });

      expect(task.priority).toBe('high');
    });

    it('should create a task with parent task ID', () => {
      const parentExecutor = jest.fn().mockResolvedValue('parent result');
      const parentTask = manager.createTask('Parent Task', 'Parent desc', parentExecutor);

      const childExecutor = jest.fn().mockResolvedValue('child result');
      const childTask = manager.createTask('Child Task', 'Child desc', childExecutor, {
        parentTaskId: parentTask.id,
      });

      expect(childTask.parentTaskId).toBe(parentTask.id);

      // Check parent has child registered
      const updatedParent = manager.getTask(parentTask.id);
      expect(updatedParent?.childTaskIds).toContain(childTask.id);
    });

    it('should create a task with timeout option', () => {
      const executor = jest.fn().mockResolvedValue('result');
      const task = manager.createTask('Timeout Task', 'Description', executor, {
        timeout: 5000,
      });

      expect(task.config.timeout).toBe(5000);
    });
  });

  describe('getTask', () => {
    it('should return undefined for non-existent task', () => {
      const task = manager.getTask('non-existent-id');
      expect(task).toBeUndefined();
    });

    it('should return the task when it exists', () => {
      const executor = jest.fn().mockResolvedValue('result');
      const createdTask = manager.createTask('Test Task', 'Description', executor);

      const retrievedTask = manager.getTask(createdTask.id);
      expect(retrievedTask).toBe(createdTask);
    });
  });

  describe('getRunningTasks', () => {
    it('should return empty array when no tasks are running', () => {
      const running = manager.getRunningTasks();
      expect(running).toEqual([]);
    });
  });

  describe('getQueuedTasks', () => {
    it('should return queued tasks', () => {
      const executor = jest.fn().mockResolvedValue('result');
      manager.createTask('Task 1', 'Desc 1', executor);
      manager.createTask('Task 2', 'Desc 2', executor);

      const queued = manager.getQueuedTasks();
      expect(queued.length).toBe(2);
    });
  });

  describe('cancelTask', () => {
    it('should cancel a queued task', () => {
      const executor = jest.fn().mockResolvedValue('result');
      const task = manager.createTask('Test Task', 'Description', executor);

      const result = manager.cancelTask(task.id);
      expect(result).toBe(true);

      const cancelledTask = manager.getTask(task.id);
      expect(cancelledTask?.status).toBe('cancelled');
    });

    it('should return false for non-existent task', () => {
      const result = manager.cancelTask('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('updateProgress', () => {
    it('should return false for non-existent task', () => {
      const result = manager.updateProgress('non-existent-id', 50);
      expect(result).toBe(false);
    });

    it('should return false for non-running task', () => {
      const executor = jest.fn().mockResolvedValue('result');
      const task = manager.createTask('Test Task', 'Description', executor);

      const result = manager.updateProgress(task.id, 50);
      expect(result).toBe(false);
    });
  });

  describe('addOutput', () => {
    it('should add output to a task', () => {
      const executor = jest.fn().mockResolvedValue('result');
      const task = manager.createTask('Test Task', 'Description', executor);

      const result = manager.addOutput(task.id, 'stdout', 'Test output');
      expect(result).toBe(true);

      const output = manager.getTaskOutput(task.id);
      expect(output.length).toBe(1);
      expect(output[0].content).toBe('Test output');
      expect(output[0].type).toBe('stdout');
    });

    it('should return false for non-existent task', () => {
      const result = manager.addOutput('non-existent-id', 'stdout', 'Test');
      expect(result).toBe(false);
    });
  });

  describe('getTaskOutput', () => {
    it('should return empty array for non-existent task', () => {
      const output = manager.getTaskOutput('non-existent-id');
      expect(output).toEqual([]);
    });

    it('should return all task output', () => {
      const executor = jest.fn().mockResolvedValue('result');
      const task = manager.createTask('Test Task', 'Description', executor);

      manager.addOutput(task.id, 'stdout', 'Line 1');
      manager.addOutput(task.id, 'stderr', 'Error 1');
      manager.addOutput(task.id, 'progress', 'Working...');

      const output = manager.getTaskOutput(task.id);
      expect(output.length).toBe(3);
      expect(output[0].type).toBe('stdout');
      expect(output[1].type).toBe('stderr');
      expect(output[2].type).toBe('progress');
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const stats = manager.getStats();

      expect(stats).toHaveProperty('totalQueued');
      expect(stats).toHaveProperty('totalRunning');
      expect(stats).toHaveProperty('totalCompleted');
      expect(stats).toHaveProperty('totalFailed');
      expect(stats).toHaveProperty('isProcessing');
    });

    it('should update after adding tasks', () => {
      const executor = jest.fn().mockResolvedValue('result');
      manager.createTask('Task 1', 'Desc', executor);
      manager.createTask('Task 2', 'Desc', executor);

      const stats = manager.getStats();
      expect(stats.totalQueued).toBe(2);
    });
  });

  describe('clearQueue', () => {
    it('should clear all queued tasks', () => {
      const executor = jest.fn().mockResolvedValue('result');
      manager.createTask('Task 1', 'Desc', executor);
      manager.createTask('Task 2', 'Desc', executor);

      const clearedCount = manager.clearQueue();
      expect(clearedCount).toBe(2);

      const stats = manager.getStats();
      expect(stats.totalQueued).toBe(0);
    });
  });

  describe('clearHistory', () => {
    it('should return 0 when no completed tasks', () => {
      const clearedCount = manager.clearHistory();
      expect(clearedCount).toBe(0);
    });
  });

  describe('setMaxConcurrent', () => {
    it('should update max concurrent limit', () => {
      manager.setMaxConcurrent(5);

      const state = manager.getQueueState();
      expect(state.maxConcurrent).toBe(5);
    });
  });

  describe('formatTaskDisplay', () => {
    it('should format queued task correctly', () => {
      const executor = jest.fn().mockResolvedValue('result');
      const task = manager.createTask('Test Task', 'Description', executor);

      const display = manager.formatTaskDisplay(task);
      expect(display).toContain('Test Task');
    });

    it('should format high priority task with label', () => {
      const executor = jest.fn().mockResolvedValue('result');
      const task = manager.createTask('High Priority', 'Description', executor, {
        priority: 'high',
      });

      const display = manager.formatTaskDisplay(task);
      expect(display).toContain('[HIGH]');
    });

    it('should format low priority task with label', () => {
      const executor = jest.fn().mockResolvedValue('result');
      const task = manager.createTask('Low Priority', 'Description', executor, {
        priority: 'low',
      });

      const display = manager.formatTaskDisplay(task);
      expect(display).toContain('[LOW]');
    });
  });

  describe('getTaskListDisplay', () => {
    it('should return "No background tasks" when empty', () => {
      const display = manager.getTaskListDisplay();
      expect(display).toBe('No background tasks.');
    });

    it('should show queued tasks', () => {
      const executor = jest.fn().mockResolvedValue('result');
      manager.createTask('Task 1', 'Desc', executor);
      manager.createTask('Task 2', 'Desc', executor);

      const display = manager.getTaskListDisplay();
      expect(display).toContain('Queued Tasks');
      expect(display).toContain('Task 1');
      expect(display).toContain('Task 2');
    });
  });

  describe('subagent spawning', () => {
    it('should spawn a subagent', () => {
      const subagent = manager.spawnSubagent({
        name: 'Test Subagent',
        description: 'Test task',
        instructions: 'Do something',
        provider: 'openai',
        model: 'gpt-4',
      });

      expect(subagent).toBeDefined();
      expect(subagent.config.name).toBe('Test Subagent');
      expect(subagent.status).toBe('active');
      expect(subagent.messages.length).toBe(1);
      expect(subagent.messages[0].role).toBe('system');
    });

    it('should spawn a subagent with parent task', () => {
      const executor = jest.fn().mockResolvedValue('result');
      const parentTask = manager.createTask('Parent', 'Parent task', executor);

      const subagent = manager.spawnSubagent(
        {
          name: 'Child Subagent',
          description: 'Child task',
          instructions: 'Do child things',
          provider: 'openai',
          model: 'gpt-4',
        },
        parentTask.id
      );

      expect(subagent).toBeDefined();

      // The subagent creates a task, check parent has the child
      const updatedParent = manager.getTask(parentTask.id);
      expect(updatedParent?.childTaskIds.length).toBeGreaterThan(0);
    });

    it('should get subagent by ID', () => {
      const subagent = manager.spawnSubagent({
        name: 'Test Subagent',
        description: 'Test task',
        instructions: 'Do something',
        provider: 'openai',
        model: 'gpt-4',
      });

      const retrieved = manager.getSubagent(subagent.id);
      expect(retrieved).toBe(subagent);
    });

    it('should return undefined for non-existent subagent', () => {
      const retrieved = manager.getSubagent('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should get active subagents', () => {
      manager.spawnSubagent({
        name: 'Subagent 1',
        description: 'Task 1',
        instructions: 'Do 1',
        provider: 'openai',
        model: 'gpt-4',
      });

      manager.spawnSubagent({
        name: 'Subagent 2',
        description: 'Task 2',
        instructions: 'Do 2',
        provider: 'openai',
        model: 'gpt-4',
      });

      const active = manager.getActiveSubagents();
      expect(active.length).toBe(2);
    });

    it('should terminate a subagent', () => {
      const subagent = manager.spawnSubagent({
        name: 'Test Subagent',
        description: 'Test task',
        instructions: 'Do something',
        provider: 'openai',
        model: 'gpt-4',
      });

      const result = manager.terminateSubagent(subagent.id);
      expect(result).toBe(true);
      expect(subagent.status).toBe('completed');
    });

    it('should return false when terminating non-existent subagent', () => {
      const result = manager.terminateSubagent('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('subscribeToOutput', () => {
    it('should return unsubscribe function', () => {
      const executor = jest.fn().mockResolvedValue('result');
      const task = manager.createTask('Test Task', 'Description', executor);
      const callback = jest.fn();

      const unsubscribe = manager.subscribeToOutput(task.id, callback);
      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
    });
  });

  describe('getQueueState', () => {
    it('should return queue state', () => {
      const state = manager.getQueueState();

      expect(state).toHaveProperty('isProcessing');
      expect(state).toHaveProperty('maxConcurrent');
      expect(state).toHaveProperty('runningTasks');
      expect(state).toHaveProperty('queuedTasks');
      expect(state).toHaveProperty('completedTasks');
    });
  });

  describe('getCompletedTasks', () => {
    it('should return empty array initially', () => {
      const completed = manager.getCompletedTasks();
      expect(completed).toEqual([]);
    });
  });

  describe('getFailedTasks', () => {
    it('should return empty array initially', () => {
      const failed = manager.getFailedTasks();
      expect(failed).toEqual([]);
    });
  });

  describe('cleanup', () => {
    it('should clean up all resources', () => {
      const executor = jest.fn().mockResolvedValue('result');
      manager.createTask('Task 1', 'Description', executor);
      manager.createTask('Task 2', 'Description', executor);

      manager.spawnSubagent({
        name: 'Subagent',
        description: 'Test',
        instructions: 'Test',
        provider: 'openai',
        model: 'gpt-4',
      });

      manager.cleanup();

      // After cleanup, manager should be in clean state
      expect(manager.getActiveSubagents()).toEqual([]);
    });
  });
});
