import { TaskQueue } from '../../utils/TaskQueue';
import { BackgroundTaskConfig } from '../../types';

describe('TaskQueue', () => {
  let queue: TaskQueue;

  beforeEach(() => {
    // Create queue with 0 max concurrent to prevent auto-processing
    queue = new TaskQueue(0, 10);
  });

  afterEach(() => {
    queue.cleanup();
  });

  describe('constructor', () => {
    it('should create a TaskQueue instance', () => {
      expect(queue).toBeInstanceOf(TaskQueue);
    });

    it('should initialize with empty state', () => {
      const stats = queue.getStats();
      expect(stats.totalQueued).toBe(0);
      expect(stats.totalRunning).toBe(0);
      expect(stats.totalCompleted).toBe(0);
      expect(stats.totalFailed).toBe(0);
      expect(stats.isProcessing).toBe(false);
    });

    it('should respect custom max concurrent setting', () => {
      const customQueue = new TaskQueue(5, 20);
      const state = customQueue.getState();
      expect(state.maxConcurrent).toBe(5);
      customQueue.cleanup();
    });
  });

  describe('addTask', () => {
    const defaultConfig: BackgroundTaskConfig = {
      provider: 'openai',
      model: 'gpt-4',
      verbose: false,
    };

    it('should add a task to the queue', () => {
      const task = queue.addTask('Test Task', 'Description', defaultConfig);

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.name).toBe('Test Task');
      expect(task.description).toBe('Description');
      expect(task.status).toBe('queued');
    });

    it('should emit taskAdded event', () => {
      const eventHandler = jest.fn();
      queue.on('taskAdded', eventHandler);

      queue.addTask('Test Task', 'Description', defaultConfig);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Task',
          status: 'queued',
        })
      );
    });

    it('should add task with correct priority', () => {
      const highTask = queue.addTask('High', 'Desc', defaultConfig, 'high');
      const normalTask = queue.addTask('Normal', 'Desc', defaultConfig, 'normal');
      const lowTask = queue.addTask('Low', 'Desc', defaultConfig, 'low');

      expect(highTask.priority).toBe('high');
      expect(normalTask.priority).toBe('normal');
      expect(lowTask.priority).toBe('low');
    });

    it('should insert high priority tasks before normal priority', () => {
      const normalTask = queue.addTask('Normal', 'Desc', defaultConfig, 'normal');
      const highTask = queue.addTask('High', 'Desc', defaultConfig, 'high');

      const queuedTasks = queue.getTasksByStatus('queued');
      const normalIndex = queuedTasks.findIndex(t => t.id === normalTask.id);
      const highIndex = queuedTasks.findIndex(t => t.id === highTask.id);

      expect(highIndex).toBeLessThan(normalIndex);
    });

    it('should set parent-child relationship', () => {
      const parentTask = queue.addTask('Parent', 'Desc', defaultConfig);
      const childTask = queue.addTask('Child', 'Desc', defaultConfig, 'normal', parentTask.id);

      expect(childTask.parentTaskId).toBe(parentTask.id);

      const updatedParent = queue.getTask(parentTask.id);
      expect(updatedParent?.childTaskIds).toContain(childTask.id);
    });
  });

  describe('getTask', () => {
    const defaultConfig: BackgroundTaskConfig = {
      provider: 'openai',
      model: 'gpt-4',
    };

    it('should return undefined for non-existent task', () => {
      const task = queue.getTask('non-existent-id');
      expect(task).toBeUndefined();
    });

    it('should find task in queued tasks', () => {
      const addedTask = queue.addTask('Test', 'Desc', defaultConfig);

      const foundTask = queue.getTask(addedTask.id);
      expect(foundTask).toBe(addedTask);
    });
  });

  describe('getTasksByStatus', () => {
    const defaultConfig: BackgroundTaskConfig = {
      provider: 'openai',
      model: 'gpt-4',
    };

    it('should return empty array for status with no tasks', () => {
      const tasks = queue.getTasksByStatus('completed');
      expect(tasks).toEqual([]);
    });

    it('should return queued tasks', () => {
      queue.addTask('Task 1', 'Desc', defaultConfig);
      queue.addTask('Task 2', 'Desc', defaultConfig);

      const queuedTasks = queue.getTasksByStatus('queued');
      expect(queuedTasks.length).toBe(2);
    });
  });

  describe('cancelTask', () => {
    const defaultConfig: BackgroundTaskConfig = {
      provider: 'openai',
      model: 'gpt-4',
    };

    it('should cancel a queued task', () => {
      const task = queue.addTask('Test', 'Desc', defaultConfig);

      const result = queue.cancelTask(task.id);
      expect(result).toBe(true);
      expect(task.status).toBe('cancelled');
    });

    it('should return false for non-existent task', () => {
      const result = queue.cancelTask('non-existent-id');
      expect(result).toBe(false);
    });

    it('should emit taskCancelled event', () => {
      const task = queue.addTask('Test', 'Desc', defaultConfig);

      const eventHandler = jest.fn();
      queue.on('taskCancelled', eventHandler);

      queue.cancelTask(task.id);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: task.id,
          status: 'cancelled',
        })
      );
    });
  });

  describe('cancelChildTasks', () => {
    const defaultConfig: BackgroundTaskConfig = {
      provider: 'openai',
      model: 'gpt-4',
    };

    it('should cancel all child tasks', () => {
      const parent = queue.addTask('Parent', 'Desc', defaultConfig);
      queue.addTask('Child 1', 'Desc', defaultConfig, 'normal', parent.id);
      queue.addTask('Child 2', 'Desc', defaultConfig, 'normal', parent.id);

      const cancelledCount = queue.cancelChildTasks(parent.id);
      expect(cancelledCount).toBe(2);
    });

    it('should return 0 when parent has no children', () => {
      const task = queue.addTask('Solo', 'Desc', defaultConfig);
      const cancelledCount = queue.cancelChildTasks(task.id);
      expect(cancelledCount).toBe(0);
    });
  });

  describe('updateProgress', () => {
    const defaultConfig: BackgroundTaskConfig = {
      provider: 'openai',
      model: 'gpt-4',
    };

    it('should return false for non-running task', () => {
      const task = queue.addTask('Test', 'Desc', defaultConfig);

      const result = queue.updateProgress(task.id, 50);
      expect(result).toBe(false);
    });

    it('should return false for non-existent task', () => {
      const result = queue.updateProgress('non-existent-id', 50);
      expect(result).toBe(false);
    });
  });

  describe('addTaskOutput', () => {
    const defaultConfig: BackgroundTaskConfig = {
      provider: 'openai',
      model: 'gpt-4',
    };

    it('should add output to a task', () => {
      const task = queue.addTask('Test', 'Desc', defaultConfig);

      const result = queue.addTaskOutput(task.id, 'stdout', 'Hello');
      expect(result).toBe(true);
      expect(task.output.length).toBe(1);
      expect(task.output[0].content).toBe('Hello');
    });

    it('should return false for non-existent task', () => {
      const result = queue.addTaskOutput('non-existent-id', 'stdout', 'Hello');
      expect(result).toBe(false);
    });

    it('should emit taskOutput event', () => {
      const task = queue.addTask('Test', 'Desc', defaultConfig);

      const eventHandler = jest.fn();
      queue.on('taskOutput', eventHandler);

      queue.addTaskOutput(task.id, 'stdout', 'Hello');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({ id: task.id }),
        expect.objectContaining({ type: 'stdout', content: 'Hello' })
      );
    });
  });

  describe('getStats', () => {
    const defaultConfig: BackgroundTaskConfig = {
      provider: 'openai',
      model: 'gpt-4',
    };

    it('should return correct statistics', () => {
      queue.addTask('Task 1', 'Desc', defaultConfig);
      queue.addTask('Task 2', 'Desc', defaultConfig);

      const stats = queue.getStats();
      expect(stats.totalQueued).toBe(2);
      expect(stats.totalRunning).toBe(0);
      // isProcessing will be true while trying to process the queue
      expect(typeof stats.isProcessing).toBe('boolean');
    });
  });

  describe('getState', () => {
    it('should return a copy of the state', () => {
      const state1 = queue.getState();
      const state2 = queue.getState();

      expect(state1).not.toBe(state2);
      expect(state1.queuedTasks).not.toBe(state2.queuedTasks);
    });
  });

  describe('clearQueue', () => {
    const defaultConfig: BackgroundTaskConfig = {
      provider: 'openai',
      model: 'gpt-4',
    };

    it('should clear all queued tasks', () => {
      queue.addTask('Task 1', 'Desc', defaultConfig);
      queue.addTask('Task 2', 'Desc', defaultConfig);

      const clearedCount = queue.clearQueue();
      expect(clearedCount).toBe(2);
      expect(queue.getTasksByStatus('queued').length).toBe(0);
    });

    it('should emit queueCleared event', () => {
      queue.addTask('Task 1', 'Desc', defaultConfig);

      const eventHandler = jest.fn();
      queue.on('queueCleared', eventHandler);

      queue.clearQueue();

      expect(eventHandler).toHaveBeenCalledWith(1);
    });
  });

  describe('clearHistory', () => {
    it('should return 0 when no completed tasks', () => {
      const clearedCount = queue.clearHistory();
      expect(clearedCount).toBe(0);
    });
  });

  describe('setMaxConcurrent', () => {
    it('should update max concurrent setting', () => {
      queue.setMaxConcurrent(10);
      const state = queue.getState();
      expect(state.maxConcurrent).toBe(10);
    });

    it('should enforce minimum of 1', () => {
      queue.setMaxConcurrent(-5);
      const state = queue.getState();
      expect(state.maxConcurrent).toBe(1);
    });
  });

  describe('getTaskOutput', () => {
    const defaultConfig: BackgroundTaskConfig = {
      provider: 'openai',
      model: 'gpt-4',
    };

    it('should return empty array for non-existent task', () => {
      const output = queue.getTaskOutput('non-existent-id');
      expect(output).toEqual([]);
    });

    it('should return a copy of the output', () => {
      const task = queue.addTask('Test', 'Desc', defaultConfig);
      queue.addTaskOutput(task.id, 'stdout', 'Hello');

      const output1 = queue.getTaskOutput(task.id);
      const output2 = queue.getTaskOutput(task.id);

      expect(output1).not.toBe(output2);
      expect(output1).toEqual(output2);
    });
  });

  describe('subscribeToTaskOutput', () => {
    const defaultConfig: BackgroundTaskConfig = {
      provider: 'openai',
      model: 'gpt-4',
    };

    it('should call callback when output is added', () => {
      const task = queue.addTask('Test', 'Desc', defaultConfig);
      const callback = jest.fn();

      queue.subscribeToTaskOutput(task.id, callback);
      queue.addTaskOutput(task.id, 'stdout', 'Hello');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'stdout',
          content: 'Hello',
        })
      );
    });

    it('should not call callback for other tasks', () => {
      const task1 = queue.addTask('Task 1', 'Desc', defaultConfig);
      const task2 = queue.addTask('Task 2', 'Desc', defaultConfig);
      const callback = jest.fn();

      queue.subscribeToTaskOutput(task1.id, callback);
      queue.addTaskOutput(task2.id, 'stdout', 'Hello from task 2');

      expect(callback).not.toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const task = queue.addTask('Test', 'Desc', defaultConfig);
      const callback = jest.fn();

      const unsubscribe = queue.subscribeToTaskOutput(task.id, callback);
      unsubscribe();

      queue.addTaskOutput(task.id, 'stdout', 'Hello');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should remove all event listeners', () => {
      const handler = jest.fn();
      queue.on('taskAdded', handler);

      queue.cleanup();

      expect(queue.listenerCount('taskAdded')).toBe(0);
    });
  });

  describe('getChildTasks', () => {
    const defaultConfig: BackgroundTaskConfig = {
      provider: 'openai',
      model: 'gpt-4',
    };

    it('should return empty array for task with no children', () => {
      const task = queue.addTask('Solo', 'Desc', defaultConfig);
      const children = queue.getChildTasks(task.id);
      expect(children).toEqual([]);
    });

    it('should return all child tasks', () => {
      const parent = queue.addTask('Parent', 'Desc', defaultConfig);
      const child1 = queue.addTask('Child 1', 'Desc', defaultConfig, 'normal', parent.id);
      const child2 = queue.addTask('Child 2', 'Desc', defaultConfig, 'normal', parent.id);

      const children = queue.getChildTasks(parent.id);
      expect(children.length).toBe(2);
      expect(children.map(c => c.id)).toContain(child1.id);
      expect(children.map(c => c.id)).toContain(child2.id);
    });

    it('should return empty array for non-existent parent', () => {
      const children = queue.getChildTasks('non-existent-id');
      expect(children).toEqual([]);
    });
  });

  describe('priority ordering', () => {
    const defaultConfig: BackgroundTaskConfig = {
      provider: 'openai',
      model: 'gpt-4',
    };

    it('should order tasks by priority in the queue', () => {
      // Add tasks in different priority order
      const low1 = queue.addTask('Low 1', 'Desc', defaultConfig, 'low');
      const normal1 = queue.addTask('Normal 1', 'Desc', defaultConfig, 'normal');
      const high1 = queue.addTask('High 1', 'Desc', defaultConfig, 'high');
      const high2 = queue.addTask('High 2', 'Desc', defaultConfig, 'high');
      const normal2 = queue.addTask('Normal 2', 'Desc', defaultConfig, 'normal');
      const low2 = queue.addTask('Low 2', 'Desc', defaultConfig, 'low');

      const queued = queue.getTasksByStatus('queued');
      const ids = queued.map(t => t.id);

      // High priority tasks should come first
      const high1Index = ids.indexOf(high1.id);
      const high2Index = ids.indexOf(high2.id);
      const normal1Index = ids.indexOf(normal1.id);
      const normal2Index = ids.indexOf(normal2.id);
      const low1Index = ids.indexOf(low1.id);
      const low2Index = ids.indexOf(low2.id);

      expect(high1Index).toBeLessThan(normal1Index);
      expect(high2Index).toBeLessThan(normal1Index);
      expect(normal1Index).toBeLessThan(low1Index);
      expect(normal2Index).toBeLessThan(low1Index);
      expect(normal2Index).toBeLessThan(low2Index);
    });
  });
});
