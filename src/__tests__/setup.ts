import '@testing-library/jest-dom';

// Add OpenAI shim for Node.js environment
// import 'openai/shims/node'; // Commented out for OpenAI v5 compatibility

// Mock fetch globally to prevent real API calls in tests
// Use a spy that can be overridden by individual tests
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Polyfill TextDecoder for gpt-tokenizer
global.TextDecoder = require('util').TextDecoder;
global.TextEncoder = require('util').TextEncoder;
