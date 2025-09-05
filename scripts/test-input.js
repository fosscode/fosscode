#!/usr/bin/env node

/**
 * Simple input testing script to help diagnose terminal input issues
 * Run with: node scripts/test-input.js
 */

import readline from 'readline';

console.log('🧪 Terminal Input Test');
console.log('Type some text and press Enter. This will help diagnose input issues.');
console.log('Press Ctrl+C to exit.\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> ',
});

rl.prompt();

rl.on('line', input => {
  console.log(`Received: "${input}"`);
  console.log(`Length: ${input.length}`);
  console.log(
    `Characters: ${Array.from(input)
      .map(c => `${c} (code: ${c.charCodeAt(0)})`)
      .join(', ')}\n`
  );
  rl.prompt();
});

rl.on('SIGINT', () => {
  console.log('\n👋 Input test completed.');
  rl.close();
});

process.on('exit', () => {
  console.log('Test finished.');
});
