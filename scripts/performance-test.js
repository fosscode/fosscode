#!/usr/bin/env node

/**
 * Performance testing script for fosscode
 * Measures startup time, memory usage, and response times
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

class PerformanceTester {
  constructor() {
    this.results = {
      startupTime: 0,
      memoryUsage: {},
      responseTimes: [],
      bundleSize: 0,
    };
  }

  /**
   * Measure application startup time
   */
  async measureStartupTime() {
    console.log('📊 Measuring startup time...');

    const startTime = process.hrtime.bigint();

    return new Promise((resolve, reject) => {
      const child = spawn('bun', ['run', 'src/index.ts', '--help'], {
        cwd: path.join(__dirname, '..'),
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';
      let errorOutput = '';

      child.stdout.on('data', data => {
        output += data.toString();
      });

      child.stderr.on('data', data => {
        errorOutput += data.toString();
      });

      child.on('close', code => {
        const endTime = process.hrtime.bigint();
        const startupTimeMs = Number(endTime - startTime) / 1_000_000;

        this.results.startupTime = startupTimeMs;
        console.log(`⚡ Startup time: ${startupTimeMs.toFixed(2)}ms`);

        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
        }
      });

      child.on('error', reject);
    });
  }

  /**
   * Measure bundle size
   */
  async measureBundleSize() {
    console.log('📦 Measuring bundle size...');

    const distPath = path.join(__dirname, '..', 'dist');
    const indexPath = path.join(distPath, 'index.js');

    if (fs.existsSync(indexPath)) {
      const stats = fs.statSync(indexPath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

      this.results.bundleSize = stats.size;
      console.log(`📦 Bundle size: ${sizeKB} KB (${sizeMB} MB)`);
    } else {
      console.log('⚠️  Bundle not found, run build first');
    }
  }

  /**
   * Measure memory usage during operation
   */
  async measureMemoryUsage() {
    console.log('🧠 Measuring memory usage...');

    return new Promise((resolve, reject) => {
      const child = spawn('bun', ['run', 'src/index.ts', '--help'], {
        cwd: path.join(__dirname, '..'),
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const checkMemory = () => {
        try {
          // Get memory info from /proc/self/status (Linux)
          if (fs.existsSync('/proc/self/status')) {
            const status = fs.readFileSync('/proc/self/status', 'utf8');
            const vmRSS = status.match(/VmRSS:\s+(\d+)\s+kB/)?.[1];
            const vmSize = status.match(/VmSize:\s+(\d+)\s+kB/)?.[1];

            if (vmRSS && vmSize) {
              this.results.memoryUsage = {
                rssKB: parseInt(vmRSS),
                virtualKB: parseInt(vmSize),
                rssMB: (parseInt(vmRSS) / 1024).toFixed(2),
                virtualMB: (parseInt(vmSize) / 1024).toFixed(2),
              };

              console.log(
                `🧠 Memory usage: RSS ${this.results.memoryUsage.rssMB} MB, Virtual ${this.results.memoryUsage.virtualMB} MB`
              );
            }
          }
        } catch (error) {
          // Ignore memory measurement errors
        }
      };

      // Check memory at intervals
      const memoryInterval = setInterval(checkMemory, 100);

      child.on('close', () => {
        clearInterval(memoryInterval);
        resolve();
      });

      child.on('error', error => {
        clearInterval(memoryInterval);
        reject(error);
      });
    });
  }

  /**
   * Run comprehensive performance test
   */
  async runFullTest() {
    console.log('🚀 Starting comprehensive performance test...\n');

    try {
      await this.measureBundleSize();
      await this.measureStartupTime();
      await this.measureMemoryUsage();

      this.printResults();
      this.saveResults();
    } catch (error) {
      console.error('❌ Performance test failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Print test results
   */
  printResults() {
    console.log('\n📊 Performance Test Results:');
    console.log('='.repeat(50));

    if (this.results.bundleSize > 0) {
      const sizeMB = (this.results.bundleSize / 1024 / 1024).toFixed(2);
      console.log(`📦 Bundle Size: ${sizeMB} MB`);
    }

    if (this.results.startupTime > 0) {
      console.log(`⚡ Startup Time: ${this.results.startupTime.toFixed(2)}ms`);
    }

    if (Object.keys(this.results.memoryUsage).length > 0) {
      console.log(`🧠 Memory Usage: RSS ${this.results.memoryUsage.rssMB || 'N/A'} MB`);
    }

    // Performance assessment
    console.log('\n🎯 Performance Assessment:');

    if (this.results.startupTime > 0) {
      if (this.results.startupTime < 500) {
        console.log('✅ Startup time is excellent (< 500ms)');
      } else if (this.results.startupTime < 2000) {
        console.log('✅ Startup time is good (< 2s)');
      } else {
        console.log('⚠️  Startup time could be improved');
      }
    }

    if (this.results.bundleSize > 0) {
      const sizeMB = this.results.bundleSize / 1024 / 1024;
      if (sizeMB < 5) {
        console.log('✅ Bundle size is excellent (< 5MB)');
      } else if (sizeMB < 10) {
        console.log('✅ Bundle size is good (< 10MB)');
      } else {
        console.log('⚠️  Bundle size could be optimized');
      }
    }
  }

  /**
   * Save results to file
   */
  saveResults() {
    const resultsPath = path.join(__dirname, '..', 'performance-results.json');

    try {
      fs.writeFileSync(
        resultsPath,
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            ...this.results,
          },
          null,
          2
        )
      );

      console.log(`💾 Results saved to: ${resultsPath}`);
    } catch (error) {
      console.warn('⚠️  Could not save results:', error.message);
    }
  }
}

// Run the performance test if this script is executed directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new PerformanceTester();
  tester.runFullTest().catch(console.error);
}

export default PerformanceTester;
