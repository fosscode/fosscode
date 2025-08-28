#!/usr/bin/env node

/**
 * Demo script to test the DuckDuckGoTool functionality
 */

import { DuckDuckGoTool } from './src/tools/DuckDuckGoTool.js';

async function demo() {
  console.log('🦆 DuckDuckGo Tool Demo\n');

  const tool = new DuckDuckGoTool();

  // Test 1: Simple search
  console.log('Test 1: Simple search for "JavaScript"');
  console.log('='.repeat(50));

  try {
    const result1 = await tool.execute({ query: 'JavaScript' });
    if (result1.success) {
      console.log('✅ Success!');
      console.log('Instant Answer:', result1.data.raw.instantAnswer || 'None');
      console.log('Abstract:', result1.data.raw.abstract?.text || 'None');
      console.log('Related Topics:', result1.data.raw.relatedTopics.length);
      console.log('Results:', result1.data.raw.results.length);
      console.log('\nFormatted Output:');
      console.log(result1.data.formatted.substring(0, 300) + '...');
    } else {
      console.log('❌ Error:', result1.error);
    }
  } catch (error) {
    console.log('❌ Exception:', error.message);
  }

  console.log('\n' + '='.repeat(50));

  // Test 2: Search with markdown format
  console.log('\nTest 2: Search for "Python programming" with markdown format');
  console.log('='.repeat(50));

  try {
    const result2 = await tool.execute({
      query: 'Python programming',
      format: 'markdown',
    });
    if (result2.success) {
      console.log('✅ Success!');
      console.log('Markdown Output:');
      console.log(result2.data.formatted.substring(0, 500) + '...');
    } else {
      console.log('❌ Error:', result2.error);
    }
  } catch (error) {
    console.log('❌ Exception:', error.message);
  }

  console.log('\n' + '='.repeat(50));

  // Test 3: Error handling
  console.log('\nTest 3: Error handling with empty query');
  console.log('='.repeat(50));

  try {
    const result3 = await tool.execute({ query: '' });
    if (result3.success) {
      console.log('✅ Unexpected success');
    } else {
      console.log('✅ Expected error:', result3.error);
    }
  } catch (error) {
    console.log('❌ Exception:', error.message);
  }

  console.log('\n🎉 Demo completed!');
}

// Run the demo
demo().catch(console.error);
