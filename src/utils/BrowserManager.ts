import { chromium, Browser, Page, BrowserContext, Response, Request } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

/**
 * Browser action types supported by the BrowserManager
 */
export type BrowserAction =
  | 'navigate'
  | 'click'
  | 'type'
  | 'screenshot'
  | 'evaluate'
  | 'close'
  | 'wait'
  | 'query'
  | 'get_network_logs';

/**
 * Browser action parameters
 */
export interface BrowserActionParams {
  action: BrowserAction;
  url?: string;
  selector?: string;
  text?: string;
  script?: string;
  headless?: boolean;
  timeout?: number;
  waitFor?: 'load' | 'domcontentloaded' | 'networkidle';
  savePath?: string;
  fullPage?: boolean;
}

/**
 * Network request log entry
 */
export interface NetworkLogEntry {
  url: string;
  method: string;
  status?: number;
  contentType?: string;
  timing?: number;
  timestamp: string;
  type: 'request' | 'response';
  resourceType?: string;
}

/**
 * DOM element info returned by query action
 */
export interface DOMElementInfo {
  tag: string;
  id?: string;
  className?: string;
  text?: string;
  href?: string;
  src?: string;
  attributes: Record<string, string>;
  isVisible: boolean;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Browser action result
 */
export interface BrowserActionResult {
  success: boolean;
  action: BrowserAction;
  data?: {
    url?: string;
    title?: string;
    screenshot?: string;
    screenshotPath?: string;
    evaluationResult?: any;
    elements?: DOMElementInfo[];
    networkLogs?: NetworkLogEntry[];
    elementCount?: number;
    clicked?: boolean;
    typed?: boolean;
    message?: string;
  };
  error?: string;
  executionTime?: number;
}

/**
 * BrowserManager - Manages browser automation using Playwright
 *
 * Features:
 * - Navigate to URLs
 * - Click elements by selector
 * - Type text into form fields
 * - Capture screenshots
 * - Execute JavaScript in page context
 * - Query and inspect DOM elements
 * - Monitor network requests
 * - Headless mode support
 */
export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private headless: boolean = true;
  private networkLogs: NetworkLogEntry[] = [];
  private maxNetworkLogs: number = 1000;

  constructor(headless: boolean = true) {
    this.headless = headless;
  }

  /**
   * Initialize the browser instance
   */
  async initialize(headless?: boolean): Promise<void> {
    if (headless !== undefined) {
      this.headless = headless;
    }

    if (this.browser) {
      await this.close();
    }

    this.browser = await chromium.launch({
      headless: this.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    this.page = await this.context.newPage();

    // Set up network monitoring
    this.setupNetworkMonitoring();
  }

  /**
   * Set up network request/response monitoring
   */
  private setupNetworkMonitoring(): void {
    if (!this.page) return;

    this.page.on('request', (request: Request) => {
      this.addNetworkLog({
        url: request.url(),
        method: request.method(),
        timestamp: new Date().toISOString(),
        type: 'request',
        resourceType: request.resourceType(),
      });
    });

    this.page.on('response', (response: Response) => {
      this.addNetworkLog({
        url: response.url(),
        method: response.request().method(),
        status: response.status(),
        contentType: response.headers()['content-type'],
        timing: response.request().timing().responseEnd,
        timestamp: new Date().toISOString(),
        type: 'response',
        resourceType: response.request().resourceType(),
      });
    });
  }

  /**
   * Add a network log entry with size limiting
   */
  private addNetworkLog(entry: NetworkLogEntry): void {
    this.networkLogs.push(entry);
    if (this.networkLogs.length > this.maxNetworkLogs) {
      this.networkLogs.shift();
    }
  }

  /**
   * Clear network logs
   */
  clearNetworkLogs(): void {
    this.networkLogs = [];
  }

  /**
   * Get all network logs
   */
  getNetworkLogs(): NetworkLogEntry[] {
    return [...this.networkLogs];
  }

  /**
   * Ensure browser is initialized
   */
  private async ensureBrowser(): Promise<Page> {
    if (!this.browser || !this.page) {
      await this.initialize();
    }
    if (!this.page) {
      throw new Error('Failed to initialize browser page');
    }
    return this.page;
  }

  /**
   * Navigate to a URL
   */
  async navigate(url: string, waitFor: 'load' | 'domcontentloaded' | 'networkidle' = 'load', timeout: number = 30000): Promise<BrowserActionResult> {
    const startTime = Date.now();
    try {
      const page = await this.ensureBrowser();

      await page.goto(url, {
        waitUntil: waitFor,
        timeout,
      });

      const title = await page.title();
      const currentUrl = page.url();

      return {
        success: true,
        action: 'navigate',
        data: {
          url: currentUrl,
          title,
        },
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        action: 'navigate',
        error: error instanceof Error ? error.message : 'Navigation failed',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Click an element by selector
   */
  async click(selector: string, timeout: number = 5000): Promise<BrowserActionResult> {
    const startTime = Date.now();
    try {
      const page = await this.ensureBrowser();

      await page.click(selector, { timeout });

      return {
        success: true,
        action: 'click',
        data: {
          clicked: true,
          message: `Clicked element: ${selector}`,
        },
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        action: 'click',
        error: error instanceof Error ? error.message : `Failed to click: ${selector}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Type text into an element
   */
  async type(selector: string, text: string, timeout: number = 5000): Promise<BrowserActionResult> {
    const startTime = Date.now();
    try {
      const page = await this.ensureBrowser();

      await page.fill(selector, text, { timeout });

      return {
        success: true,
        action: 'type',
        data: {
          typed: true,
          message: `Typed text into: ${selector}`,
        },
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        action: 'type',
        error: error instanceof Error ? error.message : `Failed to type into: ${selector}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Capture a screenshot
   */
  async screenshot(savePath?: string, fullPage: boolean = false): Promise<BrowserActionResult> {
    const startTime = Date.now();
    try {
      const page = await this.ensureBrowser();

      // Generate a unique filename if not provided
      const screenshotPath = savePath || path.join(
        os.tmpdir(),
        `fosscode-screenshot-${Date.now()}.png`
      );

      // Ensure the directory exists
      const dir = path.dirname(screenshotPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      await page.screenshot({
        path: screenshotPath,
        fullPage,
      });

      // Read the screenshot as base64
      const screenshotBuffer = fs.readFileSync(screenshotPath);
      const base64Screenshot = screenshotBuffer.toString('base64');

      return {
        success: true,
        action: 'screenshot',
        data: {
          screenshotPath,
          screenshot: base64Screenshot,
          url: page.url(),
          title: await page.title(),
        },
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        action: 'screenshot',
        error: error instanceof Error ? error.message : 'Failed to capture screenshot',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute JavaScript in the page context
   */
  async evaluate(script: string): Promise<BrowserActionResult> {
    const startTime = Date.now();
    try {
      const page = await this.ensureBrowser();

      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const result = await page.evaluate(script);

      return {
        success: true,
        action: 'evaluate',
        data: {
          evaluationResult: result,
        },
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        action: 'evaluate',
        error: error instanceof Error ? error.message : 'Script evaluation failed',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Query DOM elements and return their info
   */
  async queryElements(selector: string, maxElements: number = 10): Promise<BrowserActionResult> {
    const startTime = Date.now();
    try {
      const page = await this.ensureBrowser();

      const elements = await page.$$eval(selector, (els, max) => {
        return els.slice(0, max).map(el => {
          const rect = el.getBoundingClientRect();
          const attrs: Record<string, string> = {};
          for (const attr of el.attributes) {
            attrs[attr.name] = attr.value;
          }

          return {
            tag: el.tagName.toLowerCase(),
            id: el.id || undefined,
            className: el.className || undefined,
            text: el.textContent?.trim().substring(0, 200) || undefined,
            href: (el as HTMLAnchorElement).href || undefined,
            src: (el as HTMLImageElement).src || undefined,
            attributes: attrs,
            isVisible: rect.width > 0 && rect.height > 0,
            boundingBox: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            },
          };
        });
      }, maxElements);

      return {
        success: true,
        action: 'query',
        data: {
          elements: elements as DOMElementInfo[],
          elementCount: elements.length,
        },
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        action: 'query',
        error: error instanceof Error ? error.message : `Failed to query elements: ${selector}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Wait for a specific condition
   */
  async wait(options: {
    selector?: string;
    timeout?: number;
    state?: 'visible' | 'hidden' | 'attached' | 'detached';
  }): Promise<BrowserActionResult> {
    const startTime = Date.now();
    try {
      const page = await this.ensureBrowser();
      const { selector, timeout = 5000, state = 'visible' } = options;

      if (selector) {
        await page.waitForSelector(selector, { timeout, state });
      } else {
        await page.waitForTimeout(timeout);
      }

      return {
        success: true,
        action: 'wait',
        data: {
          message: selector ? `Element ${selector} is ${state}` : `Waited for ${timeout}ms`,
        },
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        action: 'wait',
        error: error instanceof Error ? error.message : 'Wait operation failed',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get network logs for the current session
   */
  async getNetworkLogsAction(): Promise<BrowserActionResult> {
    const startTime = Date.now();
    return {
      success: true,
      action: 'get_network_logs',
      data: {
        networkLogs: this.getNetworkLogs(),
      },
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Execute a browser action
   */
  async executeAction(params: BrowserActionParams): Promise<BrowserActionResult> {
    const { action, headless } = params;

    // Initialize browser if needed with headless preference
    if (!this.browser && headless !== undefined) {
      this.headless = headless;
    }

    switch (action) {
      case 'navigate':
        if (!params.url) {
          return { success: false, action, error: 'URL is required for navigate action' };
        }
        return this.navigate(params.url, params.waitFor, params.timeout);

      case 'click':
        if (!params.selector) {
          return { success: false, action, error: 'Selector is required for click action' };
        }
        return this.click(params.selector, params.timeout);

      case 'type':
        if (!params.selector || !params.text) {
          return { success: false, action, error: 'Selector and text are required for type action' };
        }
        return this.type(params.selector, params.text, params.timeout);

      case 'screenshot':
        return this.screenshot(params.savePath, params.fullPage);

      case 'evaluate':
        if (!params.script) {
          return { success: false, action, error: 'Script is required for evaluate action' };
        }
        return this.evaluate(params.script);

      case 'query':
        if (!params.selector) {
          return { success: false, action, error: 'Selector is required for query action' };
        }
        return this.queryElements(params.selector);

      case 'wait':
        return this.wait({
          ...(params.selector && { selector: params.selector }),
          ...(params.timeout && { timeout: params.timeout }),
        });

      case 'get_network_logs':
        return this.getNetworkLogsAction();

      case 'close':
        return this.close();

      default:
        return {
          success: false,
          action: action as BrowserAction,
          error: `Unknown action: ${action}`,
        };
    }
  }

  /**
   * Close the browser and clean up resources
   */
  async close(): Promise<BrowserActionResult> {
    const startTime = Date.now();
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.networkLogs = [];

      return {
        success: true,
        action: 'close',
        data: {
          message: 'Browser closed successfully',
        },
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        action: 'close',
        error: error instanceof Error ? error.message : 'Failed to close browser',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Check if the browser is currently active
   */
  isActive(): boolean {
    return this.browser !== null && this.page !== null;
  }

  /**
   * Get the current page URL
   */
  async getCurrentUrl(): Promise<string | null> {
    if (!this.page) return null;
    return this.page.url();
  }

  /**
   * Get the current page title
   */
  async getCurrentTitle(): Promise<string | null> {
    if (!this.page) return null;
    return this.page.title();
  }
}

// Singleton instance for reuse across tool calls
let browserManagerInstance: BrowserManager | null = null;

/**
 * Get or create a BrowserManager instance
 */
export function getBrowserManager(headless: boolean = true): BrowserManager {
  if (!browserManagerInstance) {
    browserManagerInstance = new BrowserManager(headless);
  }
  return browserManagerInstance;
}

/**
 * Reset the browser manager instance (useful for tests)
 */
export async function resetBrowserManager(): Promise<void> {
  if (browserManagerInstance) {
    await browserManagerInstance.close();
    browserManagerInstance = null;
  }
}
