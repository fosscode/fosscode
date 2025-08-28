import * as https from 'https';
import * as http from 'http';
import * as url from 'url';
import { Tool, ToolParameter, ToolResult } from '../types/index.js';
import * as cheerio from 'cheerio';

// Optional browser rendering (only if puppeteer is available)
let puppeteer: any = null;
try {
  puppeteer = require('puppeteer');
} catch (_error) {
  // Puppeteer not available, will use basic rendering
}

/**
 * Enhanced web search and content retrieval tool
 * Provides capabilities to fetch, render, and analyze web content with JavaScript support
 */
export class WebFetchTool implements Tool {
  name = 'webfetch';
  description =
    'Fetch and retrieve web content with JavaScript rendering and analysis capabilities';

  parameters: ToolParameter[] = [
    {
      name: 'url',
      type: 'string',
      description: 'The URL to fetch content from',
      required: true,
    },
    {
      name: 'format',
      type: 'string',
      description:
        'Output format: text, markdown, html, or describe (for LLM-friendly description)',
      required: false,
      defaultValue: 'text',
    },
    {
      name: 'timeout',
      type: 'number',
      description: 'Request timeout in seconds (max 120)',
      required: false,
      defaultValue: 30,
    },
    {
      name: 'followRedirects',
      type: 'boolean',
      description: 'Whether to follow HTTP redirects',
      required: false,
      defaultValue: true,
    },
    {
      name: 'extractLinks',
      type: 'boolean',
      description: 'Extract and return all links from the page',
      required: false,
      defaultValue: false,
    },
    {
      name: 'maxContentLength',
      type: 'number',
      description: 'Maximum content length to retrieve (in bytes)',
      required: false,
      defaultValue: 500000, // 500KB
    },
    {
      name: 'renderJavaScript',
      type: 'boolean',
      description: 'Whether to render JavaScript content (requires puppeteer)',
      required: false,
      defaultValue: false,
    },
    {
      name: 'takeScreenshot',
      type: 'boolean',
      description: 'Take a screenshot of the page (requires puppeteer)',
      required: false,
      defaultValue: false,
    },
    {
      name: 'waitFor',
      type: 'string',
      description: 'CSS selector to wait for before capturing content',
      required: false,
    },
    {
      name: 'viewport',
      type: 'string',
      description: 'Viewport size for rendering (e.g., "1920x1080")',
      required: false,
      defaultValue: '1920x1080',
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const {
        url: targetUrl,
        format = 'text',
        timeout = 30,
        followRedirects = true,
        extractLinks = false,
        maxContentLength = 500000,
        renderJavaScript = false,
        takeScreenshot = false,
        waitFor,
        viewport = '1920x1080',
      } = params;

      // Validate URL
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(targetUrl);
      } catch (_error) {
        throw new Error('Invalid URL format');
      }

      // Security check: only allow http and https
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Only HTTP and HTTPS protocols are supported');
      }

      let response: any;
      let screenshot: string | undefined;
      let interactiveElements: any[] = [];
      let jsAnalysis: any = {};

      // Use browser rendering if requested and available
      if (renderJavaScript && puppeteer) {
        const browserResult = await this.renderWithBrowser(targetUrl, {
          timeout: timeout * 1000,
          takeScreenshot,
          waitFor,
          viewport,
        });
        response = browserResult.response;
        screenshot = browserResult.screenshot;
        interactiveElements = browserResult.interactiveElements;
        jsAnalysis = browserResult.jsAnalysis;
      } else {
        // Use basic HTTP fetching
        response = await this.fetchUrl(targetUrl, {
          timeout: timeout * 1000,
          followRedirects,
          maxContentLength,
        });

        // Analyze for JavaScript even without rendering
        jsAnalysis = this.analyzeJavaScript(response.content);
      }

      let processedContent: string;
      let links: string[] = [];

      if (format === 'html') {
        processedContent = response.content;
      } else if (format === 'describe') {
        // Create LLM-friendly description
        processedContent = this.createLLMDescription(response.content, {
          jsAnalysis,
          interactiveElements,
          links: extractLinks,
          screenshot: !!screenshot,
        });
      } else {
        // Convert HTML to text/markdown
        const conversion = this.convertHtmlToText(response.content, format);
        processedContent = conversion.content;

        if (extractLinks) {
          links = conversion.links;
        }
      }

      return {
        success: true,
        data: {
          url: targetUrl,
          format,
          content: processedContent,
          contentLength: response.content.length,
          contentType: response.contentType,
          statusCode: response.statusCode,
          links: extractLinks ? links : undefined,
          truncated: response.truncated,
          screenshot,
          interactiveElements: interactiveElements.length > 0 ? interactiveElements : undefined,
          jsAnalysis: Object.keys(jsAnalysis).length > 0 ? jsAnalysis : undefined,
          browserRendered: renderJavaScript && puppeteer !== null,
        },
        metadata: {
          fetchTime: Date.now(),
          responseTime: response.responseTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while fetching web content',
      };
    }
  }

  /**
   * Fetch URL content with security and performance measures
   */
  private async fetchUrl(
    targetUrl: string,
    options: {
      timeout: number;
      followRedirects: boolean;
      maxContentLength: number;
    }
  ): Promise<{
    content: string;
    contentType: string;
    statusCode: number;
    truncated: boolean;
    responseTime: number;
  }> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const parsedUrl = new URL(targetUrl);

      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; fosscode-agent/1.0)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'identity',
          Connection: 'close',
        },
        timeout: options.timeout,
      };

      const req = (parsedUrl.protocol === 'https:' ? https : http).request(requestOptions, res => {
        const responseTime = Date.now() - startTime;
        let data = '';
        let truncated = false;

        res.on('data', chunk => {
          if (data.length + chunk.length > options.maxContentLength) {
            truncated = true;
            return;
          }
          data += chunk;
        });

        res.on('end', () => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            options.followRedirects
          ) {
            // Handle redirect
            const location = res.headers.location;
            if (location && typeof location === 'string') {
              this.fetchUrl(url.resolve(targetUrl, location), options).then(resolve).catch(reject);
              return;
            }
          }

          resolve({
            content: data,
            contentType: res.headers['content-type'] ?? 'unknown',
            statusCode: res.statusCode ?? 0,
            truncated,
            responseTime,
          });
        });
      });

      req.on('error', error => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Render page with browser (requires puppeteer)
   */
  private async renderWithBrowser(
    targetUrl: string,
    options: {
      timeout: number;
      takeScreenshot: boolean;
      waitFor?: string;
      viewport: string;
    }
  ): Promise<{
    response: any;
    screenshot: string | undefined;
    interactiveElements: any[];
    jsAnalysis: any;
  }> {
    if (!puppeteer) {
      throw new Error('Puppeteer not available. Install with: npm install puppeteer');
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const page = await browser.newPage();

      // Set viewport
      const [width, height] = options.viewport.split('x').map(Number);
      await page.setViewport({ width: width || 1920, height: height || 1080 });

      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (compatible; fosscode-agent/1.0)');

      // Navigate to page
      await page.goto(targetUrl, {
        waitUntil: 'networkidle2',
        timeout: options.timeout,
      });

      // Wait for specific element if requested
      if (options.waitFor) {
        await page.waitForSelector(options.waitFor, { timeout: options.timeout });
      }

      // Extract interactive elements
      const interactiveElements: any[] = await page.evaluate(() => {
        const elements: any[] = [];
        const selectors = [
          'button',
          'input[type="text"]',
          'input[type="password"]',
          'input[type="email"]',
          'input[type="submit"]',
          'input[type="button"]',
          'select',
          'textarea',
          'a[href]',
          '[onclick]',
          '[role="button"]',
          '[tabindex]:not([tabindex="-1"])',
        ];

        for (const selector of selectors) {
          const found = document.querySelectorAll(selector);
          found.forEach((el: any) => {
            const rect = el.getBoundingClientRect();
            elements.push({
              type: selector,
              tagName: el.tagName.toLowerCase(),
              text: el.textContent?.trim().substring(0, 100) || '',
              visible: rect.width > 0 && rect.height > 0,
              position: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
              attributes: {
                id: el.id || undefined,
                class: el.className || undefined,
                href: el.getAttribute('href') || undefined,
                type: el.getAttribute('type') || undefined,
                placeholder: el.getAttribute('placeholder') || undefined,
              },
            });
          });
        }

        return elements.slice(0, 50); // Limit to 50 elements
      });

      // Take screenshot if requested
      let screenshot: string | undefined;
      if (options.takeScreenshot) {
        const screenshotBuffer = await page.screenshot({ encoding: 'base64', fullPage: true });
        screenshot = `data:image/png;base64,${screenshotBuffer}`;
      }

      // Get rendered HTML content
      const content = await page.content();
      const jsAnalysis = this.analyzeJavaScript(content);

      return {
        response: {
          content,
          contentType: 'text/html',
          statusCode: 200,
          truncated: false,
          responseTime: 0,
        },
        screenshot,
        interactiveElements,
        jsAnalysis,
      };
    } finally {
      await browser.close();
    }
  }

  /**
   * Analyze JavaScript content in HTML
   */
  private analyzeJavaScript(html: string): any {
    const $ = cheerio.load(html);

    const scripts = $('script');
    let inlineScripts = 0;
    let externalScripts = 0;

    scripts.each((_, el) => {
      const src = $(el).attr('src');
      if (!src || src === '') {
        inlineScripts++;
      } else {
        externalScripts++;
      }
    });

    // Check for common JS frameworks/libraries
    const htmlContent = html.toLowerCase();
    const frameworks = {
      react: htmlContent.includes('react'),
      vue: htmlContent.includes('vue'),
      angular: htmlContent.includes('angular') || htmlContent.includes('ng-'),
      jquery: htmlContent.includes('jquery'),
      alpine: htmlContent.includes('alpine'),
      svelte: htmlContent.includes('svelte'),
    };

    // Check for dynamic content indicators
    const dynamicIndicators = {
      hasEventListeners:
        htmlContent.includes('addeventlistener') || htmlContent.includes('onclick'),
      hasAjax: htmlContent.includes('xmlhttprequest') || htmlContent.includes('fetch('),
      hasLocalStorage: htmlContent.includes('localstorage'),
      hasSessionStorage: htmlContent.includes('sessionstorage'),
    };

    return {
      scriptCount: scripts.length,
      inlineScripts,
      externalScripts,
      frameworks: Object.entries(frameworks)
        .filter(([, detected]) => detected)
        .map(([name]) => name),
      dynamicContent: Object.entries(dynamicIndicators)
        .filter(([, detected]) => detected)
        .map(([name]) => name),
      likelyRequiresJS:
        inlineScripts > 0 || externalScripts > 0 || Object.values(frameworks).some(Boolean),
    };
  }

  /**
   * Convert HTML content to text or markdown format
   */
  private convertHtmlToText(html: string, format: string): { content: string; links: string[] } {
    // Use Cheerio to safely remove <script>, <style> and extract text and links
    const $ = cheerio.load(html);
    $('script, style').remove();
    const text = $.text().replace(/\s+/g, ' ').trim();

    // Extract links from <a href="...">
    const links: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) links.push(href);
    });

    let content: string;
    if (format === 'markdown') {
      // Basic markdown conversion (this could be expanded if needed)
      content = text;
    } else {
      content = text;
    }

    return { content, links };
  }

  /**
   * Create LLM-friendly description of the page
   */
  private createLLMDescription(
    html: string,
    options: {
      jsAnalysis: any;
      interactiveElements: any[];
      links: boolean;
      screenshot: boolean;
    }
  ): string {
    const $ = cheerio.load(html);

    // Extract key page information
    const title = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const headings = $('h1, h2, h3')
      .map((_, el) => $(el).text().trim())
      .get();
    const paragraphs = $('p')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(p => p.length > 20);

    let description = `## Page Analysis: ${title || 'Untitled Page'}\n\n`;

    if (metaDescription) {
      description += `**Description:** ${metaDescription}\n\n`;
    }

    // JavaScript analysis
    if (options.jsAnalysis.likelyRequiresJS) {
      description += `### JavaScript Analysis\n`;
      description += `- **Scripts:** ${options.jsAnalysis.scriptCount} total (${options.jsAnalysis.inlineScripts} inline, ${options.jsAnalysis.externalScripts} external)\n`;

      if (options.jsAnalysis.frameworks.length > 0) {
        description += `- **Frameworks detected:** ${options.jsAnalysis.frameworks.join(', ')}\n`;
      }

      if (options.jsAnalysis.dynamicContent.length > 0) {
        description += `- **Dynamic features:** ${options.jsAnalysis.dynamicContent.join(', ')}\n`;
      }

      description += `- **Rendering recommendation:** ${options.screenshot ? 'Screenshot captured' : 'Consider using renderJavaScript=true for full content'}\n\n`;
    }

    // Headings structure
    if (headings.length > 0) {
      description += `### Content Structure\n`;
      headings.forEach((heading, index) => {
        if (heading.length > 0) {
          description += `${index + 1}. ${heading}\n`;
        }
      });
      description += '\n';
    }

    // Interactive elements
    if (options.interactiveElements.length > 0) {
      description += `### Interactive Elements (${options.interactiveElements.length})\n`;
      const elementTypes = options.interactiveElements.reduce((acc: any, el) => {
        acc[el.type] = (acc[el.type] || 0) + 1;
        return acc;
      }, {});

      Object.entries(elementTypes).forEach(([type, count]) => {
        description += `- ${type}: ${count}\n`;
      });
      description += '\n';
    }

    // Key content preview
    if (paragraphs.length > 0) {
      description += `### Content Preview\n`;
      const previewText = paragraphs.slice(0, 3).join(' ').substring(0, 500);
      description += `${previewText}${previewText.length >= 500 ? '...' : ''}\n\n`;
    }

    // Links if requested
    if (options.links) {
      const links = $('a[href]')
        .map((_, el) => $(el).attr('href'))
        .get()
        .filter(href => href && href.startsWith('http'));
      if (links.length > 0) {
        description += `### Links Found (${links.length})\n`;
        links.slice(0, 10).forEach(link => {
          description += `- ${link}\n`;
        });
        if (links.length > 10) {
          description += `- ... and ${links.length - 10} more\n`;
        }
        description += '\n';
      }
    }

    return description;
  }
}
