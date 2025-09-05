const fs = require('fs');
const path = require('path');
const os = require('os');

// Create test diff data
const testDiffData = {
  type: 'file_change',
  filePath: '/tmp/test-file.txt',
  originalContent: 'Hello World\nThis is a test file.',
  newContent: 'Hello World\nThis is a modified test file.\nNew line added.',
  timestamp: new Date().toISOString(),
  tool: 'edit',
};

// Create temp directory
const tempDir = path.join(os.tmpdir(), 'vscode-fosscode-diff');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Write test diff file
const timestamp = Date.now();
const diffFileName = `fosscode-${timestamp}.json`;
const diffFilePath = path.join(tempDir, diffFileName);

fs.writeFileSync(diffFilePath, JSON.stringify(testDiffData, null, 2), 'utf8');

console.log(`Test diff file created at: ${diffFilePath}`);
console.log('Diff data:', JSON.stringify(testDiffData, null, 2));
