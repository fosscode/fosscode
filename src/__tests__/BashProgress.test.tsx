/**
 * @jest-environment jsdom
 */

import React from 'react';

// Mock ink and ink-spinner before importing the component
jest.mock('ink', () => ({
  Box: ({ children }: { children: React.ReactNode }) => <div data-testid="box">{children}</div>,
  Text: ({ children, color }: { children: React.ReactNode; color?: string }) => (
    <span data-testid="text" data-color={color}>{children}</span>
  ),
  useStdout: () => ({
    stdout: { columns: 80 },
  }),
}));

jest.mock('ink-spinner', () => ({
  __esModule: true,
  default: () => <span data-testid="spinner">...</span>,
}));

// Import after mocks are set up
import { useBashProgress } from '../ui/components/BashProgress.js';
import { renderHook, act } from '@testing-library/react';

describe('BashProgress', () => {
  describe('useBashProgress hook', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useBashProgress());

      expect(result.current.isRunning).toBe(false);
      expect(result.current.command).toBe('');
      expect(result.current.outputLines).toEqual([]);
      expect(result.current.startTime).toBeNull();
    });

    it('should start tracking a command', () => {
      const { result } = renderHook(() => useBashProgress());

      act(() => {
        result.current.start('npm install');
      });

      expect(result.current.isRunning).toBe(true);
      expect(result.current.command).toBe('npm install');
      expect(result.current.outputLines).toEqual([]);
      expect(result.current.startTime).toBeInstanceOf(Date);
    });

    it('should add output lines', () => {
      const { result } = renderHook(() => useBashProgress());

      act(() => {
        result.current.start('npm test');
      });

      act(() => {
        result.current.addOutput('Running tests...');
      });

      expect(result.current.outputLines).toEqual(['Running tests...']);

      act(() => {
        result.current.addOutput('Test 1 passed');
        result.current.addOutput('Test 2 passed');
      });

      expect(result.current.outputLines).toEqual([
        'Running tests...',
        'Test 1 passed',
        'Test 2 passed',
      ]);
    });

    it('should add multiple output lines at once', () => {
      const { result } = renderHook(() => useBashProgress());

      act(() => {
        result.current.start('git status');
      });

      act(() => {
        result.current.addOutputLines(['Line 1', 'Line 2', 'Line 3']);
      });

      expect(result.current.outputLines).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });

    it('should stop tracking', () => {
      const { result } = renderHook(() => useBashProgress());

      act(() => {
        result.current.start('npm build');
      });

      expect(result.current.isRunning).toBe(true);

      act(() => {
        result.current.stop();
      });

      expect(result.current.isRunning).toBe(false);
      // Other state should remain
      expect(result.current.command).toBe('npm build');
    });

    it('should reset all state', () => {
      const { result } = renderHook(() => useBashProgress());

      act(() => {
        result.current.start('make build');
        result.current.addOutput('Compiling...');
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.isRunning).toBe(false);
      expect(result.current.command).toBe('');
      expect(result.current.outputLines).toEqual([]);
      expect(result.current.startTime).toBeNull();
    });

    it('should clear output when starting a new command', () => {
      const { result } = renderHook(() => useBashProgress());

      act(() => {
        result.current.start('command1');
        result.current.addOutput('output from command1');
      });

      expect(result.current.outputLines).toHaveLength(1);

      act(() => {
        result.current.start('command2');
      });

      expect(result.current.command).toBe('command2');
      expect(result.current.outputLines).toEqual([]);
    });
  });
});
