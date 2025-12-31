import {
  BrowserManager,
  getBrowserManager,
  resetBrowserManager,
  BrowserAction,
  BrowserActionParams,
} from '../utils/BrowserManager';

// Mock playwright
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue({
      newContext: jest.fn().mockResolvedValue({
        newPage: jest.fn().mockResolvedValue({
          goto: jest.fn().mockResolvedValue(undefined),
          title: jest.fn().mockResolvedValue('Test Page'),
          url: jest.fn().mockReturnValue('https://example.com'),
          click: jest.fn().mockResolvedValue(undefined),
          fill: jest.fn().mockResolvedValue(undefined),
          screenshot: jest.fn().mockResolvedValue(undefined),
          evaluate: jest.fn().mockResolvedValue({ result: 'test' }),
          $$eval: jest.fn().mockResolvedValue([
            {
              tag: 'div',
              id: 'test-id',
              className: 'test-class',
              text: 'Test content',
              attributes: { id: 'test-id', class: 'test-class' },
              isVisible: true,
              boundingBox: { x: 0, y: 0, width: 100, height: 50 },
            },
          ]),
          waitForSelector: jest.fn().mockResolvedValue(undefined),
          waitForTimeout: jest.fn().mockResolvedValue(undefined),
          close: jest.fn().mockResolvedValue(undefined),
          on: jest.fn(),
        }),
        close: jest.fn().mockResolvedValue(undefined),
      }),
      close: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Mock fs for screenshot tests
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue(Buffer.from('fake-image-data')),
}));

describe('BrowserManager', () => {
  let browserManager: BrowserManager;

  beforeEach(async () => {
    await resetBrowserManager();
    browserManager = new BrowserManager(true);
  });

  afterEach(async () => {
    await resetBrowserManager();
  });

  describe('constructor', () => {
    it('should create a BrowserManager instance with headless mode by default', () => {
      const manager = new BrowserManager();
      expect(manager).toBeInstanceOf(BrowserManager);
    });

    it('should create a BrowserManager instance with specified headless mode', () => {
      const manager = new BrowserManager(false);
      expect(manager).toBeInstanceOf(BrowserManager);
    });
  });

  describe('initialize', () => {
    it('should initialize the browser', async () => {
      await browserManager.initialize();
      expect(browserManager.isActive()).toBe(true);
    });

    it('should reinitialize if called again', async () => {
      await browserManager.initialize();
      await browserManager.initialize(false);
      expect(browserManager.isActive()).toBe(true);
    });
  });

  describe('navigate', () => {
    it('should navigate to a URL successfully', async () => {
      const result = await browserManager.navigate('https://example.com');

      expect(result.success).toBe(true);
      expect(result.action).toBe('navigate');
      expect(result.data?.url).toBe('https://example.com');
      expect(result.data?.title).toBe('Test Page');
    });

    it('should handle navigation with different wait conditions', async () => {
      const result = await browserManager.navigate(
        'https://example.com',
        'networkidle',
        5000
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe('navigate');
    });
  });

  describe('click', () => {
    it('should click an element by selector', async () => {
      await browserManager.initialize();
      const result = await browserManager.click('#test-button');

      expect(result.success).toBe(true);
      expect(result.action).toBe('click');
      expect(result.data?.clicked).toBe(true);
    });
  });

  describe('type', () => {
    it('should type text into an element', async () => {
      await browserManager.initialize();
      const result = await browserManager.type('#input-field', 'Hello World');

      expect(result.success).toBe(true);
      expect(result.action).toBe('type');
      expect(result.data?.typed).toBe(true);
    });
  });

  describe('screenshot', () => {
    it('should capture a screenshot', async () => {
      await browserManager.initialize();
      const result = await browserManager.screenshot();

      expect(result.success).toBe(true);
      expect(result.action).toBe('screenshot');
      expect(result.data?.screenshot).toBeDefined();
      expect(result.data?.screenshotPath).toBeDefined();
    });

    it('should capture a full page screenshot', async () => {
      await browserManager.initialize();
      const result = await browserManager.screenshot(undefined, true);

      expect(result.success).toBe(true);
      expect(result.action).toBe('screenshot');
    });

    it('should save screenshot to custom path', async () => {
      await browserManager.initialize();
      const result = await browserManager.screenshot('/tmp/test-screenshot.png');

      expect(result.success).toBe(true);
      expect(result.data?.screenshotPath).toBe('/tmp/test-screenshot.png');
    });
  });

  describe('evaluate', () => {
    it('should execute JavaScript in page context', async () => {
      await browserManager.initialize();
      const result = await browserManager.evaluate('return { result: "test" }');

      expect(result.success).toBe(true);
      expect(result.action).toBe('evaluate');
      expect(result.data?.evaluationResult).toEqual({ result: 'test' });
    });
  });

  describe('queryElements', () => {
    it('should query DOM elements', async () => {
      await browserManager.initialize();
      const result = await browserManager.queryElements('.test-class');

      expect(result.success).toBe(true);
      expect(result.action).toBe('query');
      expect(result.data?.elements).toBeDefined();
      expect(result.data?.elementCount).toBeGreaterThan(0);
    });
  });

  describe('wait', () => {
    it('should wait for a selector', async () => {
      await browserManager.initialize();
      const result = await browserManager.wait({
        selector: '#loading',
        timeout: 5000,
        state: 'visible',
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('wait');
    });

    it('should wait for a timeout when no selector provided', async () => {
      await browserManager.initialize();
      const result = await browserManager.wait({
        timeout: 100,
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('wait');
    });
  });

  describe('close', () => {
    it('should close the browser', async () => {
      await browserManager.initialize();
      const result = await browserManager.close();

      expect(result.success).toBe(true);
      expect(result.action).toBe('close');
      expect(browserManager.isActive()).toBe(false);
    });

    it('should handle closing when not initialized', async () => {
      const result = await browserManager.close();

      expect(result.success).toBe(true);
      expect(result.action).toBe('close');
    });
  });

  describe('network logs', () => {
    it('should return empty network logs initially', () => {
      const logs = browserManager.getNetworkLogs();
      expect(logs).toEqual([]);
    });

    it('should clear network logs', async () => {
      browserManager.clearNetworkLogs();
      const logs = browserManager.getNetworkLogs();
      expect(logs).toEqual([]);
    });
  });

  describe('executeAction', () => {
    it('should execute navigate action', async () => {
      const params: BrowserActionParams = {
        action: 'navigate',
        url: 'https://example.com',
      };

      const result = await browserManager.executeAction(params);

      expect(result.success).toBe(true);
      expect(result.action).toBe('navigate');
    });

    it('should return error for navigate without URL', async () => {
      const params: BrowserActionParams = {
        action: 'navigate',
      };

      const result = await browserManager.executeAction(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('URL is required');
    });

    it('should execute click action', async () => {
      await browserManager.initialize();
      const params: BrowserActionParams = {
        action: 'click',
        selector: '#button',
      };

      const result = await browserManager.executeAction(params);

      expect(result.success).toBe(true);
      expect(result.action).toBe('click');
    });

    it('should return error for click without selector', async () => {
      const params: BrowserActionParams = {
        action: 'click',
      };

      const result = await browserManager.executeAction(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Selector is required');
    });

    it('should execute type action', async () => {
      await browserManager.initialize();
      const params: BrowserActionParams = {
        action: 'type',
        selector: '#input',
        text: 'test text',
      };

      const result = await browserManager.executeAction(params);

      expect(result.success).toBe(true);
      expect(result.action).toBe('type');
    });

    it('should return error for type without selector or text', async () => {
      const params: BrowserActionParams = {
        action: 'type',
        selector: '#input',
      };

      const result = await browserManager.executeAction(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Selector and text are required');
    });

    it('should execute screenshot action', async () => {
      await browserManager.initialize();
      const params: BrowserActionParams = {
        action: 'screenshot',
        fullPage: true,
      };

      const result = await browserManager.executeAction(params);

      expect(result.success).toBe(true);
      expect(result.action).toBe('screenshot');
    });

    it('should execute evaluate action', async () => {
      await browserManager.initialize();
      const params: BrowserActionParams = {
        action: 'evaluate',
        script: 'return document.title',
      };

      const result = await browserManager.executeAction(params);

      expect(result.success).toBe(true);
      expect(result.action).toBe('evaluate');
    });

    it('should return error for evaluate without script', async () => {
      const params: BrowserActionParams = {
        action: 'evaluate',
      };

      const result = await browserManager.executeAction(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Script is required');
    });

    it('should execute query action', async () => {
      await browserManager.initialize();
      const params: BrowserActionParams = {
        action: 'query',
        selector: '.elements',
      };

      const result = await browserManager.executeAction(params);

      expect(result.success).toBe(true);
      expect(result.action).toBe('query');
    });

    it('should return error for query without selector', async () => {
      const params: BrowserActionParams = {
        action: 'query',
      };

      const result = await browserManager.executeAction(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Selector is required');
    });

    it('should execute wait action', async () => {
      await browserManager.initialize();
      const params: BrowserActionParams = {
        action: 'wait',
        selector: '#element',
        timeout: 1000,
      };

      const result = await browserManager.executeAction(params);

      expect(result.success).toBe(true);
      expect(result.action).toBe('wait');
    });

    it('should execute get_network_logs action', async () => {
      const params: BrowserActionParams = {
        action: 'get_network_logs',
      };

      const result = await browserManager.executeAction(params);

      expect(result.success).toBe(true);
      expect(result.action).toBe('get_network_logs');
      expect(result.data?.networkLogs).toBeDefined();
    });

    it('should execute close action', async () => {
      await browserManager.initialize();
      const params: BrowserActionParams = {
        action: 'close',
      };

      const result = await browserManager.executeAction(params);

      expect(result.success).toBe(true);
      expect(result.action).toBe('close');
    });

    it('should return error for unknown action', async () => {
      const params = {
        action: 'unknown_action' as BrowserAction,
      };

      const result = await browserManager.executeAction(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action');
    });
  });

  describe('utility methods', () => {
    it('should check if browser is active', async () => {
      expect(browserManager.isActive()).toBe(false);

      await browserManager.initialize();
      expect(browserManager.isActive()).toBe(true);

      await browserManager.close();
      expect(browserManager.isActive()).toBe(false);
    });

    it('should get current URL', async () => {
      expect(await browserManager.getCurrentUrl()).toBeNull();

      await browserManager.initialize();
      const url = await browserManager.getCurrentUrl();
      expect(url).toBeDefined();
    });

    it('should get current title', async () => {
      expect(await browserManager.getCurrentTitle()).toBeNull();

      await browserManager.initialize();
      const title = await browserManager.getCurrentTitle();
      expect(title).toBe('Test Page');
    });
  });
});

describe('getBrowserManager', () => {
  beforeEach(async () => {
    await resetBrowserManager();
  });

  afterEach(async () => {
    await resetBrowserManager();
  });

  it('should return a singleton instance', () => {
    const manager1 = getBrowserManager();
    const manager2 = getBrowserManager();
    expect(manager1).toBe(manager2);
  });

  it('should respect headless parameter on first call', () => {
    const manager = getBrowserManager(false);
    expect(manager).toBeInstanceOf(BrowserManager);
  });
});

describe('resetBrowserManager', () => {
  it('should reset the singleton instance', async () => {
    const manager1 = getBrowserManager();
    await manager1.initialize();

    await resetBrowserManager();

    const manager2 = getBrowserManager();
    expect(manager2.isActive()).toBe(false);
  });
});
