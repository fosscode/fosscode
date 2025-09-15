#!/usr/bin/env node

/**
 * Post-install script to replace vulnerable dependencies with custom implementations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Patching vulnerable dependencies...');

// Path to our custom implementations
const customIndentString = path.join(__dirname, '..', 'src', 'utils', 'indent-string.ts');
const customShellQuote = path.join(__dirname, '..', 'src', 'utils', 'shell-quote.ts');

// Node modules paths
const indentStringPath = path.join(__dirname, '..', 'node_modules', 'indent-string');
const shellQuotePath = path.join(__dirname, '..', 'node_modules', 'shell-quote');

try {
  // Replace indent-string
  if (fs.existsSync(indentStringPath)) {
    console.log('📝 Replacing indent-string with custom implementation...');

    // Remove the existing package
    fs.rmSync(indentStringPath, { recursive: true, force: true });

    // Create a new package.json for our custom implementation
    const indentStringPackageJson = {
      name: 'indent-string',
      version: '5.0.0',
      main: path.relative(path.dirname(indentStringPath), customIndentString.replace('.ts', '.js')),
      types: path.relative(
        path.dirname(indentStringPath),
        customIndentString.replace('.ts', '.d.ts')
      ),
    };

    fs.mkdirSync(indentStringPath, { recursive: true });
    fs.writeFileSync(
      path.join(indentStringPath, 'package.json'),
      JSON.stringify(indentStringPackageJson, null, 2)
    );

    // Copy our implementation
    fs.copyFileSync(customIndentString, path.join(indentStringPath, 'index.ts'));
  }

  // Replace shell-quote
  if (fs.existsSync(shellQuotePath)) {
    console.log('📝 Replacing shell-quote with custom implementation...');

    // Remove the existing package
    fs.rmSync(shellQuotePath, { recursive: true, force: true });

    // Create a new package.json for our custom implementation
    const shellQuotePackageJson = {
      name: 'shell-quote',
      version: '1.8.3',
      main: path.relative(path.dirname(shellQuotePath), customShellQuote.replace('.ts', '.js')),
      types: path.relative(path.dirname(shellQuotePath), customShellQuote.replace('.ts', '.d.ts')),
    };

    fs.mkdirSync(shellQuotePath, { recursive: true });
    fs.writeFileSync(
      path.join(shellQuotePath, 'package.json'),
      JSON.stringify(shellQuotePackageJson, null, 2)
    );

    // Copy our implementation
    fs.copyFileSync(customShellQuote, path.join(shellQuotePath, 'index.ts'));
  }

  console.log('✅ Successfully patched vulnerable dependencies!');
} catch (error) {
  console.error('❌ Error patching dependencies:', error.message);
  process.exit(1);
}
