import { MCPConnectionManager, MCPHealthEvent } from '../mcp/MCPConnectionManager.js';

// Mock child_process module
jest.mock('child_process', () => ({
  spawn: jest.fn(() => {
    const EventEmitter = require('events');
    const mockProcess = new EventEmitter();
    mockProcess.stdin = {
      write: jest.fn(),
    };
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = jest.fn();
    return mockProcess;
  }),
}));

describe('MCPConnectionManager', () => {
  let connectionManager: MCPConnectionManager;

  beforeEach(() => {
    jest.useFakeTimers();
    connectionManager = new MCPConnectionManager();
  });

  afterEach(() => {
    connectionManager.cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('health event handling', () => {
    it('should register health event handlers', () => {
      const handler = jest.fn();
      connectionManager.onHealthEvent(handler);

      // Emit a mock event through the private method
      (connectionManager as any).emitHealthEvent({ type: 'healthy', serverName: 'test' });

      expect(handler).toHaveBeenCalledWith({ type: 'healthy', serverName: 'test' });
    });

    it('should remove health event handlers', () => {
      const handler = jest.fn();
      connectionManager.onHealthEvent(handler);
      connectionManager.offHealthEvent(handler);

      (connectionManager as any).emitHealthEvent({ type: 'healthy', serverName: 'test' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle errors in event handlers gracefully', () => {
      const errorHandler = jest.fn(() => {
        throw new Error('Handler error');
      });
      const goodHandler = jest.fn();

      connectionManager.onHealthEvent(errorHandler);
      connectionManager.onHealthEvent(goodHandler);

      // Should not throw
      expect(() => {
        (connectionManager as any).emitHealthEvent({ type: 'healthy', serverName: 'test' });
      }).not.toThrow();

      // Good handler should still be called
      expect(goodHandler).toHaveBeenCalled();
    });
  });

  describe('health status tracking', () => {
    it('should return empty array when no servers are connected', () => {
      expect(connectionManager.getAllServerHealth()).toEqual([]);
    });

    it('should return undefined for unknown server', () => {
      expect(connectionManager.getServerHealth('unknown')).toBeUndefined();
    });
  });

  describe('restart count tracking', () => {
    it('should return 0 for unknown server', () => {
      expect(connectionManager.getRestartCount('unknown')).toBe(0);
    });

    it('should reset restart count', () => {
      (connectionManager as any).restartCounts.set('test', 5);
      connectionManager.resetRestartCount('test');
      expect(connectionManager.getRestartCount('test')).toBe(0);
    });
  });

  describe('uptime tracking', () => {
    it('should return 0 for unknown server', () => {
      expect(connectionManager.getServerUptime('unknown')).toBe(0);
    });

    it('should calculate uptime correctly', () => {
      const startTime = new Date(Date.now() - 5000);
      (connectionManager as any).startTimes.set('test', startTime);

      const uptime = connectionManager.getServerUptime('test');
      expect(uptime).toBeGreaterThanOrEqual(5000);
    });
  });

  describe('health monitoring intervals', () => {
    it('should start health monitoring with specified interval', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      connectionManager.startHealthMonitoring('test', 10000);

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
    });

    it('should stop health monitoring', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      connectionManager.startHealthMonitoring('test', 10000);
      connectionManager.stopHealthMonitoring('test');

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should stop existing monitoring before starting new', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      connectionManager.startHealthMonitoring('test', 10000);
      connectionManager.startHealthMonitoring('test', 20000);

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('getConnectedServers', () => {
    it('should return empty array when no servers connected', () => {
      expect(connectionManager.getConnectedServers()).toEqual([]);
    });
  });

  describe('isConnected', () => {
    it('should return false for unknown server', () => {
      expect(connectionManager.isConnected('unknown')).toBe(false);
    });
  });

  describe('health event types', () => {
    it('should emit correct event types', () => {
      const events: MCPHealthEvent[] = [];
      connectionManager.onHealthEvent((event) => events.push(event));

      // Test different event types
      (connectionManager as any).emitHealthEvent({ type: 'healthy', serverName: 'test' });
      (connectionManager as any).emitHealthEvent({
        type: 'unhealthy',
        serverName: 'test',
        error: 'Connection lost',
      });
      (connectionManager as any).emitHealthEvent({
        type: 'restarting',
        serverName: 'test',
        attempt: 1,
      });
      (connectionManager as any).emitHealthEvent({ type: 'restarted', serverName: 'test' });
      (connectionManager as any).emitHealthEvent({
        type: 'restart_failed',
        serverName: 'test',
        error: 'Max attempts exceeded',
      });

      expect(events).toHaveLength(5);
      expect(events[0].type).toBe('healthy');
      expect(events[1].type).toBe('unhealthy');
      expect(events[2].type).toBe('restarting');
      expect(events[3].type).toBe('restarted');
      expect(events[4].type).toBe('restart_failed');
    });
  });

  describe('updateHealthStatus', () => {
    it('should update health status correctly', () => {
      const now = Date.now();
      (connectionManager as any).startTimes.set('test', new Date(now - 10000));
      (connectionManager as any).restartCounts.set('test', 2);

      (connectionManager as any).updateHealthStatus('test', 'healthy');

      const health = (connectionManager as any).healthStatus.get('test');
      expect(health).toBeDefined();
      expect(health.serverName).toBe('test');
      expect(health.status).toBe('healthy');
      expect(health.restartCount).toBe(2);
      expect(health.uptime).toBeGreaterThanOrEqual(10000);
    });

    it('should include error message for unhealthy status', () => {
      (connectionManager as any).updateHealthStatus('test', 'unhealthy', 'Connection timeout');

      const health = (connectionManager as any).healthStatus.get('test');
      expect(health.status).toBe('unhealthy');
      expect(health.lastError).toBe('Connection timeout');
    });
  });
});
