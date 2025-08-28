import { LMStudioProvider } from './dist/index.js';

async function testLMStudioProvider() {
  const provider = new LMStudioProvider();

  console.log('Testing LMStudio Provider...\n');

  // Test valid config
  console.log('1. Testing valid config:');
  const validConfig = { baseURL: 'http://localhost:1234' };
  try {
    const result = await provider.validateConfig(validConfig);
    console.log('   ✅ Valid config result:', result);
  } catch (err) {
    console.log('   ❌ Valid config error:', err.message);
  }

  // Test invalid config (no baseURL)
  console.log('\n2. Testing invalid config (no baseURL):');
  const invalidConfig = {};
  try {
    const result = await provider.validateConfig(invalidConfig);
    console.log('   ❌ Invalid config should have failed but returned:', result);
  } catch (err) {
    console.log('   ✅ Invalid config correctly failed:', err.message);
  }

  // Test invalid URL format
  console.log('\n3. Testing invalid URL format:');
  const invalidUrlConfig = { baseURL: 'not-a-url' };
  try {
    const result = await provider.validateConfig(invalidUrlConfig);
    console.log('   ❌ Invalid URL should have failed but returned:', result);
  } catch (err) {
    console.log('   ✅ Invalid URL correctly failed:', err.message);
  }

  // Test listModels (will likely fail without server but should not crash)
  console.log('\n4. Testing listModels:');
  try {
    const models = await provider.listModels(validConfig);
    console.log('   ✅ Models retrieved:', models);
  } catch (err) {
    console.log('   ⚠️  Models retrieval failed (expected without server):', err.message);
  }

  console.log('\n✅ LMStudio Provider tests completed!');
}

testLMStudioProvider().catch(console.error);
