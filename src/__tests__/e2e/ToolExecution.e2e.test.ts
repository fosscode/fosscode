import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

describe('CLI Functionality E2E Tests', () => {
  test('should handle help command', async () => {
    return new Promise<void>((resolve, reject) => {
      const child = spawn('bun', ['run', 'src/index.ts', '--help'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'test',
          FORCE_COLOR: '0',
        },
      });

      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Help test timed out'));
      }, 15000);

      let output = '';

      child.stdout?.on('data', data => {
        output += data.toString();
      });

      child.on('exit', code => {
        clearTimeout(timeout);
        expect(code).toBe(0);
        expect(output.length).toBeGreaterThan(0);
        expect(output).toContain('fosscode');
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 20000);

  test('should handle version command', async () => {
    return new Promise<void>((resolve, reject) => {
      const child = spawn('bun', ['run', 'src/index.ts', '--version'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'test',
          FORCE_COLOR: '0',
        },
      });

      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Version test timed out'));
      }, 15000);

      let output = '';

      child.stdout?.on('data', data => {
        output += data.toString();
      });

      child.on('exit', code => {
        clearTimeout(timeout);
        expect(code).toBe(0);
        expect(output.length).toBeGreaterThan(0);
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 20000);

  test('should handle providers command', async () => {
    return new Promise<void>((resolve, reject) => {
      const child = spawn('bun', ['run', 'src/index.ts', 'providers'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'test',
          FORCE_COLOR: '0',
        },
      });

      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Providers test timed out'));
      }, 15000);

      let output = '';

      child.stdout?.on('data', data => {
        output += data.toString();
      });

      child.on('exit', code => {
        clearTimeout(timeout);
        expect(code).toBe(0);
        expect(output.length).toBeGreaterThan(0);
        expect(output).toContain('openai');
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 20000);
});
