#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Path to the safer-buffer module in node_modules
const saferBufferPath = path.join(__dirname, '..', 'node_modules', 'safer-buffer');
const saferJsPath = path.join(saferBufferPath, 'safer.js');

// Our replacement content
const replacementContent = `/* eslint-disable node/no-deprecated-api */

'use strict'

var buffer = require('buffer')
var Buffer = buffer.Buffer

var safer = {}

var key

for (key in buffer) {
  if (!buffer.hasOwnProperty(key)) continue
  if (key === 'SlowBuffer' || key === 'Buffer') continue
  safer[key] = buffer[key]
}

var Safer = safer.Buffer = {}
for (key in Buffer) {
  if (!Buffer.hasOwnProperty(key)) continue
  // Keep allocUnsafe for compatibility but discourage its use
  Safer[key] = Buffer[key]
}

safer.Buffer.prototype = Buffer.prototype

// Simple polyfills for older Node.js versions (though we target Node 18+)
if (!Safer.from || Safer.from === Uint8Array.from) {
  Safer.from = function (value, encodingOrOffset, length) {
    if (typeof value === 'number') {
      throw new TypeError('The "value" argument must not be of type number. Received type ' + typeof value)
    }
    return Buffer.from(value, encodingOrOffset, length)
  }
}

if (!Safer.alloc) {
  Safer.alloc = function (size, fill, encoding) {
    if (typeof size !== 'number') {
      throw new TypeError('The "size" argument must be of type number. Received type ' + typeof size)
    }
    return Buffer.alloc(size, fill, encoding)
  }
}

if (!safer.constants) {
  safer.constants = {
    MAX_LENGTH: buffer.kMaxLength || (1 << 30) - 1
  }
}

module.exports = safer
`;

try {
  // Check if safer-buffer exists
  if (fs.existsSync(saferJsPath)) {
    console.log('🔧 Replacing safer-buffer with native Buffer API...');

    // Backup original
    const backupPath = path.join(saferBufferPath, 'safer.js.backup');
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(saferJsPath, backupPath);
    }

    // Replace with our version
    fs.writeFileSync(saferJsPath, replacementContent, 'utf8');

    console.log('✅ safer-buffer replaced successfully!');
    console.log('   - Uses native Node.js Buffer API (safe in Node 18+)');
    console.log('   - Maintains compatibility with existing code');
    console.log('   - Original backed up to safer.js.backup');
  } else {
    console.log('ℹ️  safer-buffer not found, skipping replacement');
  }
} catch (error) {
  console.error('❌ Error replacing safer-buffer:', error.message);
  process.exit(1);
}
