import '@testing-library/jest-dom';

// Add OpenAI shim for Node.js environment
import 'openai/shims/node';

// Mock chalk to prevent ES module issues
jest.mock('chalk', () => ({
  default: jest.fn((text: string) => text),
  red: jest.fn((text: string) => text),
  green: jest.fn((text: string) => text),
  yellow: jest.fn((text: string) => text),
  blue: jest.fn((text: string) => text),
  magenta: jest.fn((text: string) => text),
  cyan: jest.fn((text: string) => text),
  white: jest.fn((text: string) => text),
  gray: jest.fn((text: string) => text),
  black: jest.fn((text: string) => text),
  bgRed: jest.fn((text: string) => text),
  bgGreen: jest.fn((text: string) => text),
  bgYellow: jest.fn((text: string) => text),
  bgBlue: jest.fn((text: string) => text),
  bgMagenta: jest.fn((text: string) => text),
  bgCyan: jest.fn((text: string) => text),
  bgWhite: jest.fn((text: string) => text),
  bold: jest.fn((text: string) => text),
  dim: jest.fn((text: string) => text),
  italic: jest.fn((text: string) => text),
  underline: jest.fn((text: string) => text),
  inverse: jest.fn((text: string) => text),
  strikethrough: jest.fn((text: string) => text),
}));

// Mock fetch globally to prevent real API calls in tests
// Use a spy that can be overridden by individual tests
const mockFetch = jest.fn();
global.fetch = mockFetch;
