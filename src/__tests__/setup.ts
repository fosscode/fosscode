import '@testing-library/jest-dom';

// Add OpenAI shim for Node.js environment
import 'openai/shims/node';

// Mock chalk to prevent ES module issues
jest.mock('chalk', () => {
  const mockChalk = jest.fn((text: string) => text);
  const mockFn = jest.fn((text: string) => text);

  return {
    __esModule: true,
    default: mockChalk,
    red: mockFn,
    green: mockFn,
    yellow: mockFn,
    blue: mockFn,
    magenta: mockFn,
    cyan: mockFn,
    white: mockFn,
    gray: mockFn,
    black: mockFn,
    bgRed: mockFn,
    bgGreen: mockFn,
    bgYellow: mockFn,
    bgBlue: mockFn,
    bgMagenta: mockFn,
    bgCyan: mockFn,
    bgWhite: mockFn,
    bold: mockFn,
    dim: mockFn,
    italic: mockFn,
    underline: mockFn,
    inverse: mockFn,
    strikethrough: mockFn,
  };
});

// Mock fetch globally to prevent real API calls in tests
// Use a spy that can be overridden by individual tests
const mockFetch = jest.fn();
global.fetch = mockFetch;
