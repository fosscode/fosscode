import * as https from 'https';
import * as http from 'http';
import * as url from 'url';
import { Tool, ToolParameter, ToolResult } from '../types/index.js';
import * as cheerio from 'cheerio';

/**
 * Web search and content retrieval tool
 * Provides capabilities to fetch and process web content with security measures
 */
export class WebFetchTool implements Tool {
  name = 'webfetch';
  description = 'Fetch and retrieve web content for research and information gathering';

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
      description: 'Output format: text, markdown, or html',
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

      // Fetch content
      const response = await this.fetchUrl(targetUrl, {
        timeout: timeout * 1000,
        followRedirects,
        maxContentLength,
      });

      let processedContent: string;
      let links: string[] = [];

      if (format === 'html') {
        processedContent = response.content;
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
}
