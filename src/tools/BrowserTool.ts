import { Tool, ToolParameter, ToolResult } from '../types/index.js';
import {
  BrowserManager,
  getBrowserManager,
  BrowserAction,
  BrowserActionParams,
} from '../utils/BrowserManager.js';

/**
 * Browser automation tool for fosscode
 *
 * Provides comprehensive browser automation capabilities including:
 * - Navigation to URLs
 * - Clicking elements
 * - Typing into form fields
 * - Screenshot capture
 * - JavaScript evaluation
 * - DOM element querying
 * - Network request monitoring
 * - Headless mode support
 */
export class BrowserTool implements Tool {
  name = 'browser';
  description =
    'Browser automation tool for navigating web pages, interacting with elements, capturing screenshots, executing JavaScript, inspecting DOM, and monitoring network requests. Supports headless mode.';

  parameters: ToolParameter[] = [
    {
      name: 'action',
      type: 'string',
      description:
        'The browser action to perform: navigate, click, type, screenshot, evaluate, query, wait, get_network_logs, or close',
      required: true,
    },
    {
      name: 'url',
      type: 'string',
      description: 'URL to navigate to (required for navigate action)',
      required: false,
    },
    {
      name: 'selector',
      type: 'string',
      description: 'CSS selector for element interactions (required for click, type, query actions)',
      required: false,
    },
    {
      name: 'text',
      type: 'string',
      description: 'Text to type into an element (required for type action)',
      required: false,
    },
    {
      name: 'script',
      type: 'string',
      description: 'JavaScript code to execute in the page context (required for evaluate action)',
      required: false,
    },
    {
      name: 'headless',
      type: 'boolean',
      description: 'Run browser in headless mode (no GUI). Defaults to true.',
      required: false,
      defaultValue: true,
    },
    {
      name: 'timeout',
      type: 'number',
      description: 'Timeout in milliseconds for the action. Defaults to 30000 for navigation, 5000 for other actions.',
      required: false,
    },
    {
      name: 'waitFor',
      type: 'string',
      description: 'Wait condition for navigation: load, domcontentloaded, or networkidle. Defaults to load.',
      required: false,
      defaultValue: 'load',
    },
    {
      name: 'savePath',
      type: 'string',
      description: 'File path to save screenshot (optional, will use temp directory if not provided)',
      required: false,
    },
    {
      name: 'fullPage',
      type: 'boolean',
      description: 'Capture full page screenshot instead of visible viewport. Defaults to false.',
      required: false,
      defaultValue: false,
    },
  ];

  private browserManager: BrowserManager | null = null;

  /**
   * Get or create a browser manager instance
   */
  private getBrowserManager(headless: boolean = true): BrowserManager {
    if (!this.browserManager) {
      this.browserManager = getBrowserManager(headless);
    }
    return this.browserManager;
  }

  /**
   * Validate action parameter
   */
  private validateAction(action: string): action is BrowserAction {
    const validActions: BrowserAction[] = [
      'navigate',
      'click',
      'type',
      'screenshot',
      'evaluate',
      'query',
      'wait',
      'get_network_logs',
      'close',
    ];
    return validActions.includes(action as BrowserAction);
  }

  /**
   * Validate URL format
   */
  private validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const {
        action,
        url,
        selector,
        text,
        script,
        headless = true,
        timeout,
        waitFor = 'load',
        savePath,
        fullPage = false,
      } = params;

      // Validate action
      if (!action || typeof action !== 'string') {
        return {
          success: false,
          error: 'Action parameter is required and must be a string',
        };
      }

      if (!this.validateAction(action)) {
        return {
          success: false,
          error: `Invalid action: ${action}. Valid actions are: navigate, click, type, screenshot, evaluate, query, wait, get_network_logs, close`,
        };
      }

      // Validate action-specific required parameters
      switch (action as BrowserAction) {
        case 'navigate':
          if (!url || typeof url !== 'string') {
            return {
              success: false,
              error: 'URL parameter is required for navigate action',
            };
          }
          if (!this.validateUrl(url)) {
            return {
              success: false,
              error: `Invalid URL format: ${url}`,
            };
          }
          break;

        case 'click':
        case 'query':
          if (!selector || typeof selector !== 'string') {
            return {
              success: false,
              error: `Selector parameter is required for ${action} action`,
            };
          }
          break;

        case 'type':
          if (!selector || typeof selector !== 'string') {
            return {
              success: false,
              error: 'Selector parameter is required for type action',
            };
          }
          if (text === undefined || text === null) {
            return {
              success: false,
              error: 'Text parameter is required for type action',
            };
          }
          break;

        case 'evaluate':
          if (!script || typeof script !== 'string') {
            return {
              success: false,
              error: 'Script parameter is required for evaluate action',
            };
          }
          break;
      }

      // Get browser manager with headless preference
      const browserManager = this.getBrowserManager(headless);

      // Build action parameters
      const actionParams: BrowserActionParams = {
        action: action as BrowserAction,
        url,
        selector,
        text: text?.toString(),
        script,
        headless,
        timeout,
        waitFor: waitFor as 'load' | 'domcontentloaded' | 'networkidle',
        savePath,
        fullPage,
      };

      // Execute the browser action
      const result = await browserManager.executeAction(actionParams);

      if (result.success) {
        return {
          success: true,
          data: {
            action: result.action,
            ...result.data,
            executionTime: result.executionTime,
          },
          metadata: {
            browserActive: browserManager.isActive(),
            headless,
            timestamp: new Date().toISOString(),
          },
        };
      } else {
        return {
          success: false,
          error: result.error || `Browser action '${action}' failed`,
          metadata: {
            browserActive: browserManager.isActive(),
            action: result.action,
            executionTime: result.executionTime,
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred during browser automation',
      };
    }
  }
}

/**
 * Factory function to create a BrowserTool instance
 */
export function createBrowserTool(): BrowserTool {
  return new BrowserTool();
}
