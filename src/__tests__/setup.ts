import '@testing-library/jest-dom';

// Add OpenAI shim for Node.js environment
import 'openai/shims/node';

// Mock fetch globally to prevent real API calls in tests
// Use a spy that can be overridden by individual tests
const mockFetch = jest.fn();
global.fetch = mockFetch;
