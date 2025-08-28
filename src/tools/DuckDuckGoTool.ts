import * as https from 'https';
import { Tool, ToolParameter, ToolResult } from '../types/index.js';

/**
 * DuckDuckGo search and instant answer tool
 * Provides access to DuckDuckGo's instant answers and search results
 */
export class DuckDuckGoTool implements Tool {
  name = 'duckduckgo';
  description = 'Search DuckDuckGo for instant answers and information';

  parameters: ToolParameter[] = [
    {
      name: 'query',
      type: 'string',
      description: 'The search query to send to DuckDuckGo',
      required: true,
    },
    {
      name: 'format',
      type: 'string',
      description: 'Response format: json, text, or markdown',
      required: false,
      defaultValue: 'text',
    },
    {
      name: 'timeout',
      type: 'number',
      description: 'Request timeout in seconds (max 30)',
      required: false,
      defaultValue: 10,
    },
    {
      name: 'noRedirect',
      type: 'boolean',
      description: 'Skip HTTP redirects in results',
      required: false,
      defaultValue: false,
    },
    {
      name: 'noHtml',
      type: 'boolean',
      description: 'Remove HTML from results',
      required: false,
      defaultValue: true,
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const { query, format = 'text', timeout = 10, noRedirect = false, noHtml = true } = params;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new Error('Query parameter is required and must be a non-empty string');
      }

      // Construct DuckDuckGo API URL
      const apiUrl = this.buildApiUrl(query, {
        noRedirect,
        noHtml,
      });

      // Fetch results from DuckDuckGo API
      const response = await this.fetchDuckDuckGo(apiUrl, timeout * 1000);

      // Process and format the response
      const processedResult = this.processResponse(response, format);

      return {
        success: true,
        data: {
          query,
          format,
          ...processedResult,
        },
        metadata: {
          apiUrl,
          responseTime: response.responseTime,
          hasInstantAnswer: !!response.InstantAnswer,
          hasRelatedTopics: response.RelatedTopics?.length > 0,
          hasResults: response.Results?.length > 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while searching DuckDuckGo',
      };
    }
  }

  /**
   * Build the DuckDuckGo API URL with parameters
   */
  private buildApiUrl(query: string, options: { noRedirect: boolean; noHtml: boolean }): string {
    const baseUrl = 'https://api.duckduckgo.com/';
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      no_redirect: options.noRedirect ? '1' : '0',
      no_html: options.noHtml ? '1' : '0',
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Fetch data from DuckDuckGo API
   */
  private async fetchDuckDuckGo(url: string, timeout: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const parsedUrl = new URL(url);

      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'fosscode-agent/1.0',
          Accept: 'application/json',
        },
        timeout,
      };

      const req = https.request(requestOptions, res => {
        const responseTime = Date.now() - startTime;
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsedData = JSON.parse(data);
            resolve({
              ...parsedData,
              responseTime,
              statusCode: res.statusCode,
            });
          } catch (error) {
            reject(new Error(`Failed to parse JSON response: ${error}`));
          }
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
   * Process the DuckDuckGo API response into the requested format
   */
  private processResponse(response: any, format: string): any {
    const result: any = {
      instantAnswer: null,
      abstract: null,
      relatedTopics: [],
      results: [],
      definition: null,
      answer: null,
      answerType: null,
    };

    // Extract instant answer if available
    if (response.Answer) {
      result.instantAnswer = response.Answer;
      result.answer = response.Answer;
      result.answerType = response.AnswerType;
    }

    // Extract abstract information
    if (response.AbstractText) {
      result.abstract = {
        text: response.AbstractText,
        source: response.AbstractSource,
        url: response.AbstractURL,
      };
    }

    // Extract definition if available
    if (response.Definition) {
      result.definition = {
        text: response.Definition,
        source: response.DefinitionSource,
        url: response.DefinitionURL,
      };
    }

    // Process related topics
    if (response.RelatedTopics && Array.isArray(response.RelatedTopics)) {
      result.relatedTopics = response.RelatedTopics.map((topic: any) => ({
        text: topic.Text,
        firstUrl: topic.FirstURL,
        icon: topic.Icon?.URL,
        result: topic.Result,
      })).filter((topic: any) => topic.text || topic.result);
    }

    // Process main results
    if (response.Results && Array.isArray(response.Results)) {
      result.results = response.Results.map((item: any) => ({
        text: item.Text,
        firstUrl: item.FirstURL,
        icon: item.Icon?.URL,
        result: item.Result,
      }));
    }

    // Format the output based on requested format
    if (format === 'json') {
      return result;
    } else if (format === 'markdown') {
      return {
        formatted: this.formatAsMarkdown(result),
        raw: result,
      };
    } else {
      // Default text format
      return {
        formatted: this.formatAsText(result),
        raw: result,
      };
    }
  }

  /**
   * Format results as markdown
   */
  private formatAsMarkdown(result: any): string {
    let markdown = '';

    // Add instant answer
    if (result.instantAnswer) {
      markdown += `## Instant Answer\n${result.instantAnswer}\n\n`;
    }

    // Add abstract
    if (result.abstract) {
      markdown += `## Abstract\n${result.abstract.text}\n\n`;
      if (result.abstract.url) {
        markdown += `**Source:** [${result.abstract.source}](${result.abstract.url})\n\n`;
      }
    }

    // Add definition
    if (result.definition) {
      markdown += `## Definition\n${result.definition.text}\n\n`;
      if (result.definition.url) {
        markdown += `**Source:** [${result.definition.source}](${result.definition.url})\n\n`;
      }
    }

    // Add main results
    if (result.results.length > 0) {
      markdown += '## Results\n';
      result.results.forEach((item: any, index: number) => {
        markdown += `${index + 1}. **${item.text}**\n`;
        if (item.firstUrl) {
          markdown += `   [${item.firstUrl}](${item.firstUrl})\n`;
        }
        markdown += '\n';
      });
    }

    // Add related topics
    if (result.relatedTopics.length > 0) {
      markdown += '## Related Topics\n';
      result.relatedTopics.slice(0, 10).forEach((topic: any, index: number) => {
        markdown += `${index + 1}. ${topic.text || topic.result}\n`;
        if (topic.firstUrl) {
          markdown += `   [Link](${topic.firstUrl})\n`;
        }
        markdown += '\n';
      });
    }

    return markdown.trim();
  }

  /**
   * Format results as plain text
   */
  private formatAsText(result: any): string {
    let text = '';

    // Add instant answer
    if (result.instantAnswer) {
      text += `Instant Answer: ${result.instantAnswer}\n\n`;
    }

    // Add abstract
    if (result.abstract) {
      text += `Abstract: ${result.abstract.text}\n`;
      if (result.abstract.url) {
        text += `Source: ${result.abstract.url}\n`;
      }
      text += '\n';
    }

    // Add definition
    if (result.definition) {
      text += `Definition: ${result.definition.text}\n`;
      if (result.definition.url) {
        text += `Source: ${result.definition.url}\n`;
      }
      text += '\n';
    }

    // Add main results
    if (result.results.length > 0) {
      text += 'Results:\n';
      result.results.forEach((item: any, index: number) => {
        text += `${index + 1}. ${item.text}\n`;
        if (item.firstUrl) {
          text += `   ${item.firstUrl}\n`;
        }
        text += '\n';
      });
    }

    // Add related topics (limit to first 5 for brevity)
    if (result.relatedTopics.length > 0) {
      text += 'Related Topics:\n';
      result.relatedTopics.slice(0, 5).forEach((topic: any, index: number) => {
        text += `${index + 1}. ${topic.text || topic.result}\n`;
        if (topic.firstUrl) {
          text += `   ${topic.firstUrl}\n`;
        }
        text += '\n';
      });
    }

    return text.trim();
  }
}
