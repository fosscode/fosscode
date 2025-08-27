import { getTool, listAvailableTools } from './init.js';
import path from 'path';

/**
 * Demonstration of agent tools capabilities
 * This script shows how AI agents can use the implemented tools
 */
async function demonstrateTools() {
  console.log('🚀 Agent Tools Demonstration\n');

  // List all available tools
  console.log('Available Tools:');
  listAvailableTools().forEach(tool => {
    console.log(`• ${tool.name}: ${tool.description}`);
  });
  console.log();

  // Demonstrate file operations
  console.log('📁 File Operations Demo:');

  // 1. Create a test file
  const writeTool = getTool('write');
  if (writeTool) {
    console.log('Creating test file...');
    const writeResult = await writeTool.execute({
      filePath: path.join(process.cwd(), 'test-demo.txt'),
      content: `Hello World!
This is a test file for demonstrating agent tools.
It contains multiple lines and some text to search.
Line 4: This line has some content.
Last line: End of file.`,
    });

    if (writeResult.success) {
      console.log(`✅ File created: ${writeResult.data.filePath}`);
    } else {
      console.log(`❌ Write failed: ${writeResult.error}`);
    }
  }

  // 2. Search for content in the file
  const grepTool = getTool('grep');
  if (grepTool) {
    console.log('\nSearching for "line" in the test file...');
    const searchResult = await grepTool.execute({
      pattern: 'line',
      path: process.cwd(),
      include: '*.txt',
      context: 1,
    });

    if (searchResult.success) {
      console.log(`✅ Found ${searchResult.data.totalMatches} matches:`);
      searchResult.data.results.forEach((match: any) => {
        console.log(`  ${match.file}:${match.line}: ${match.match}`);
      });
    } else {
      console.log(`❌ Search failed: ${searchResult.error}`);
    }
  }

  // 3. Read part of the file
  const readTool = getTool('read');
  if (readTool) {
    console.log('\nReading lines 2-4 from the test file...');
    const readResult = await readTool.execute({
      filePath: path.join(process.cwd(), 'test-demo.txt'),
      offset: 1, // 0-based, so line 2
      limit: 3,
      withLineNumbers: true,
    });

    if (readResult.success) {
      console.log('✅ File content:');
      console.log(readResult.data.content);
    } else {
      console.log(`❌ Read failed: ${readResult.error}`);
    }
  }

  // 4. Edit the file content
  const editTool = getTool('edit');
  if (editTool) {
    console.log('\nReplacing "Hello World!" with "Hello Agent Tools!"...');
    const editResult = await editTool.execute({
      filePath: path.join(process.cwd(), 'test-demo.txt'),
      oldString: 'Hello World!',
      newString: 'Hello Agent Tools!',
      createBackup: true,
    });

    if (editResult.success) {
      console.log(
        `✅ Replacement successful: ${editResult.data.replacementsMade} replacement(s) made`
      );
      if (editResult.data.backupCreated) {
        console.log(`📁 Backup created: ${editResult.data.backupPath}`);
      }
    } else {
      console.log(`❌ Edit failed: ${editResult.error}`);
    }
  }

  // 5. Demonstrate bash command execution
  const bashTool = getTool('bash');
  if (bashTool) {
    console.log('\n💻 Bash Command Demo:');
    console.log('Running "ls -la" command...');
    const bashResult = await bashTool.execute({
      command: 'ls -la',
      cwd: process.cwd(),
      timeout: 5000,
      shell: 'bash',
    });

    if (bashResult.success) {
      console.log(`✅ Command executed (exit code: ${bashResult.data.exitCode})`);
      console.log(`📄 Output preview: ${bashResult.data.stdout.substring(0, 200)}...`);
      if (bashResult.data.stderr) {
        console.log(`⚠️  Stderr: ${bashResult.data.stderr}`);
      }
    } else {
      console.log(`❌ Bash command failed: ${bashResult.error}`);
    }
  }

  // 6. Demonstrate web fetching (if network available)
  const webFetchTool = getTool('webfetch');
  if (webFetchTool) {
    console.log('\n🌐 Web Fetch Demo:');
    console.log('Fetching opencode.ai homepage...');
    const webResult = await webFetchTool.execute({
      url: 'https://opencode.ai',
      format: 'text',
      timeout: 10,
      maxContentLength: 10000,
    });

    if (webResult.success) {
      console.log(`✅ Web content fetched (${webResult.data.contentLength} bytes)`);
      console.log(`📄 Content preview: ${webResult.data.content.substring(0, 200)}...`);
    } else {
      console.log(`❌ Web fetch failed: ${webResult.error}`);
    }
  }

  console.log('\n🎉 Agent Tools demonstration complete!');
}

// Run demonstration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateTools().catch(console.error);
}
