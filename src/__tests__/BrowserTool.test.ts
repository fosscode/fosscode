import { BrowserTool } from '../tools/BrowserTool';

// Mock the BrowserManager
jest.mock('../utils/BrowserManager', () => {
  const mockBrowserManager = {
    isActive: jest.fn().mockReturnValue(true),
    executeAction: jest.fn().mockImplementation(async (params) => {
      const { action } = params;

      switch (action) {
        case 'navigate':
          return {
            success: true,
            action: 'navigate',
            data: {
              url: params.url,
              title: 'Test Page',
            },
            executionTime: 100,
          };
        case 'click':
          return {
            success: true,
            action: 'click',
            data: {
              clicked: true,
              message: `Clicked element: ${params.selector}`,
            },
            executionTime: 50,
          };
        case 'type':
          return {
            success: true,
            action: 'type',
            data: {
              typed: true,
              message: `Typed text into: ${params.selector}`,
            },
            executionTime: 50,
          };
        case 'screenshot':
          return {
            success: true,
            action: 'screenshot',
            data: {
              screenshot: 'base64-image-data',
              screenshotPath: '/tmp/screenshot.png',
              url: 'https://example.com',
              title: 'Test Page',
            },
            executionTime: 200,
          };
        case 'evaluate':
          return {
            success: true,
            action: 'evaluate',
            data: {
              evaluationResult: { result: 'test' },
            },
            executionTime: 30,
          };
        case 'query':
          return {
            success: true,
            action: 'query',
            data: {
              elements: [
                {
                  tag: 'div',
                  id: 'test-id',
                  className: 'test-class',
                  text: 'Test content',
                  attributes: {},
                  isVisible: true,
                },
              ],
              elementCount: 1,
            },
            executionTime: 40,
          };
        case 'wait':
          return {
            success: true,
            action: 'wait',
            data: {
              message: 'Wait completed',
            },
            executionTime: 1000,
          };
        case 'get_network_logs':
          return {
            success: true,
            action: 'get_network_logs',
            data: {
              networkLogs: [
                {
                  url: 'https://example.com/api',
                  method: 'GET',
                  status: 200,
                  contentType: 'application/json',
                  timestamp: new Date().toISOString(),
                  type: 'response',
                },
              ],
            },
            executionTime: 5,
          };
        case 'close':
          return {
            success: true,
            action: 'close',
            data: {
              message: 'Browser closed successfully',
            },
            executionTime: 100,
          };
        default:
          return {
            success: false,
            action,
            error: `Unknown action: ${action}`,
          };
      }
    }),
  };

  return {
    BrowserManager: jest.fn().mockImplementation(() => mockBrowserManager),
    getBrowserManager: jest.fn().mockReturnValue(mockBrowserManager),
    resetBrowserManager: jest.fn().mockResolvedValue(undefined),
  };
});

describe('BrowserTool', () => {
  let browserTool: BrowserTool;

  beforeEach(() => {
    browserTool = new BrowserTool();
  });

  describe('basic properties', () => {
    it('should have correct name', () => {
      expect(browserTool.name).toBe('browser');
    });

    it('should have a description', () => {
      expect(browserTool.description).toContain('Browser automation');
    });

    it('should have all required parameters', () => {
      const paramNames = browserTool.parameters.map(p => p.name);

      expect(paramNames).toContain('action');
      expect(paramNames).toContain('url');
      expect(paramNames).toContain('selector');
      expect(paramNames).toContain('text');
      expect(paramNames).toContain('script');
      expect(paramNames).toContain('headless');
      expect(paramNames).toContain('timeout');
      expect(paramNames).toContain('waitFor');
      expect(paramNames).toContain('savePath');
      expect(paramNames).toContain('fullPage');
    });

    it('should have action as required parameter', () => {
      const actionParam = browserTool.parameters.find(p => p.name === 'action');
      expect(actionParam?.required).toBe(true);
    });

    it('should have optional parameters with defaults', () => {
      const headlessParam = browserTool.parameters.find(p => p.name === 'headless');
      const fullPageParam = browserTool.parameters.find(p => p.name === 'fullPage');
      const waitForParam = browserTool.parameters.find(p => p.name === 'waitFor');

      expect(headlessParam?.defaultValue).toBe(true);
      expect(fullPageParam?.defaultValue).toBe(false);
      expect(waitForParam?.defaultValue).toBe('load');
    });
  });

  describe('action validation', () => {
    it('should return error for missing action', async () => {
      const result = await browserTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Action parameter is required');
    });

    it('should return error for invalid action type', async () => {
      const result = await browserTool.execute({ action: 123 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Action parameter is required');
    });

    it('should return error for unknown action', async () => {
      const result = await browserTool.execute({ action: 'invalid_action' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid action');
      expect(result.error).toContain('navigate');
    });
  });

  describe('navigate action', () => {
    it('should navigate to a valid URL', async () => {
      const result = await browserTool.execute({
        action: 'navigate',
        url: 'https://example.com',
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('navigate');
      expect(result.data?.url).toBe('https://example.com');
    });

    it('should return error for missing URL', async () => {
      const result = await browserTool.execute({
        action: 'navigate',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('URL parameter is required');
    });

    it('should return error for invalid URL format', async () => {
      const result = await browserTool.execute({
        action: 'navigate',
        url: 'not-a-valid-url',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });

    it('should accept navigation with wait options', async () => {
      const result = await browserTool.execute({
        action: 'navigate',
        url: 'https://example.com',
        waitFor: 'networkidle',
        timeout: 60000,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('click action', () => {
    it('should click an element', async () => {
      const result = await browserTool.execute({
        action: 'click',
        selector: '#submit-button',
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('click');
      expect(result.data?.clicked).toBe(true);
    });

    it('should return error for missing selector', async () => {
      const result = await browserTool.execute({
        action: 'click',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Selector parameter is required');
    });

    it('should return error for invalid selector type', async () => {
      const result = await browserTool.execute({
        action: 'click',
        selector: 123,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Selector parameter is required');
    });
  });

  describe('type action', () => {
    it('should type text into an element', async () => {
      const result = await browserTool.execute({
        action: 'type',
        selector: '#username',
        text: 'testuser',
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('type');
      expect(result.data?.typed).toBe(true);
    });

    it('should return error for missing selector', async () => {
      const result = await browserTool.execute({
        action: 'type',
        text: 'some text',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Selector parameter is required');
    });

    it('should return error for missing text', async () => {
      const result = await browserTool.execute({
        action: 'type',
        selector: '#input',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Text parameter is required');
    });

    it('should handle empty string text', async () => {
      const result = await browserTool.execute({
        action: 'type',
        selector: '#input',
        text: '',
      });

      expect(result.success).toBe(true);
    });

    it('should handle numeric text', async () => {
      const result = await browserTool.execute({
        action: 'type',
        selector: '#input',
        text: 12345,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('screenshot action', () => {
    it('should capture a screenshot', async () => {
      const result = await browserTool.execute({
        action: 'screenshot',
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('screenshot');
      expect(result.data?.screenshot).toBeDefined();
      expect(result.data?.screenshotPath).toBeDefined();
    });

    it('should capture full page screenshot', async () => {
      const result = await browserTool.execute({
        action: 'screenshot',
        fullPage: true,
      });

      expect(result.success).toBe(true);
    });

    it('should save to custom path', async () => {
      const result = await browserTool.execute({
        action: 'screenshot',
        savePath: '/tmp/custom-screenshot.png',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('evaluate action', () => {
    it('should execute JavaScript', async () => {
      const result = await browserTool.execute({
        action: 'evaluate',
        script: 'return document.title',
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('evaluate');
      expect(result.data?.evaluationResult).toBeDefined();
    });

    it('should return error for missing script', async () => {
      const result = await browserTool.execute({
        action: 'evaluate',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Script parameter is required');
    });

    it('should return error for invalid script type', async () => {
      const result = await browserTool.execute({
        action: 'evaluate',
        script: 123,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Script parameter is required');
    });
  });

  describe('query action', () => {
    it('should query DOM elements', async () => {
      const result = await browserTool.execute({
        action: 'query',
        selector: '.item',
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('query');
      expect(result.data?.elements).toBeDefined();
      expect(result.data?.elementCount).toBeGreaterThan(0);
    });

    it('should return error for missing selector', async () => {
      const result = await browserTool.execute({
        action: 'query',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Selector parameter is required');
    });
  });

  describe('wait action', () => {
    it('should wait for an element', async () => {
      const result = await browserTool.execute({
        action: 'wait',
        selector: '#loading',
        timeout: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('wait');
    });

    it('should wait without selector (timeout only)', async () => {
      const result = await browserTool.execute({
        action: 'wait',
        timeout: 1000,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('get_network_logs action', () => {
    it('should return network logs', async () => {
      const result = await browserTool.execute({
        action: 'get_network_logs',
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('get_network_logs');
      expect(result.data?.networkLogs).toBeDefined();
      expect(Array.isArray(result.data?.networkLogs)).toBe(true);
    });
  });

  describe('close action', () => {
    it('should close the browser', async () => {
      const result = await browserTool.execute({
        action: 'close',
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('close');
      expect(result.data?.message).toContain('closed');
    });
  });

  describe('headless mode', () => {
    it('should default to headless mode', async () => {
      const result = await browserTool.execute({
        action: 'navigate',
        url: 'https://example.com',
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.headless).toBe(true);
    });

    it('should respect headless parameter', async () => {
      const result = await browserTool.execute({
        action: 'navigate',
        url: 'https://example.com',
        headless: false,
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.headless).toBe(false);
    });
  });

  describe('metadata', () => {
    it('should include execution metadata', async () => {
      const result = await browserTool.execute({
        action: 'navigate',
        url: 'https://example.com',
      });

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.browserActive).toBeDefined();
      expect(result.metadata?.timestamp).toBeDefined();
    });

    it('should include execution time', async () => {
      const result = await browserTool.execute({
        action: 'screenshot',
      });

      expect(result.success).toBe(true);
      expect(result.data?.executionTime).toBeDefined();
      expect(typeof result.data?.executionTime).toBe('number');
    });
  });

  describe('error handling', () => {
    it('should handle browser manager errors gracefully', async () => {
      const { getBrowserManager } = require('../utils/BrowserManager');
      getBrowserManager().executeAction.mockRejectedValueOnce(new Error('Browser crashed'));

      const result = await browserTool.execute({
        action: 'navigate',
        url: 'https://example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Browser crashed');
    });
  });
});

describe('createBrowserTool', () => {
  it('should create a BrowserTool instance', async () => {
    const { createBrowserTool } = await import('../tools/BrowserTool');
    const tool = createBrowserTool();

    expect(tool).toBeInstanceOf(BrowserTool);
    expect(tool.name).toBe('browser');
  });
});
