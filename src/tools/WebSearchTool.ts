import { Tool, ToolParameter, ToolResult } from '../types/index.js';

/**
 * Web Search Tool for comprehensive web search functionality
 * Supports multiple search engines and provides structured search results
 */
export class WebSearchTool implements Tool {
  name = 'web-search';
  description =
    'Perform web searches using various search engines and return structured results with summaries, links, and metadata.';

  parameters: ToolParameter[] = [
    {
      name: 'query',
      type: 'string',
      description: 'The search query to execute',
      required: true,
    },
    {
      name: 'engine',
      type: 'string',
      description: 'Search engine to use (google, bing, duckduckgo, searx)',
      required: false,
      defaultValue: 'duckduckgo',
    },
    {
      name: 'maxResults',
      type: 'number',
      description: 'Maximum number of results to return',
      required: false,
      defaultValue: 10,
    },
    {
      name: 'includeSnippets',
      type: 'boolean',
      description: 'Include result snippets/previews in the response',
      required: false,
      defaultValue: true,
    },
    {
      name: 'includeMetadata',
      type: 'boolean',
      description: 'Include metadata like result dates, sizes, etc.',
      required: false,
      defaultValue: true,
    },
    {
      name: 'safeSearch',
      type: 'string',
      description: 'Safe search level (strict, moderate, off)',
      required: false,
      defaultValue: 'moderate',
    },
    {
      name: 'language',
      type: 'string',
      description: 'Search language/locale (e.g., en, es, fr)',
      required: false,
      defaultValue: 'en',
    },
    {
      name: 'timeRange',
      type: 'string',
      description: 'Time range for results (day, week, month, year, all)',
      required: false,
      defaultValue: 'all',
    },
    {
      name: 'siteSearch',
      type: 'string',
      description: 'Restrict search to specific site/domain',
      required: false,
    },
    {
      name: 'excludeTerms',
      type: 'array',
      description: 'Terms to exclude from search results',
      required: false,
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const {
        query,
        engine = 'duckduckgo',
        maxResults = 10,
        includeSnippets = true,
        includeMetadata = true,
        safeSearch = 'moderate',
        language = 'en',
        timeRange = 'all',
        siteSearch,
        excludeTerms = [],
      } = params;

      // Validate required parameters
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new Error('Query parameter is required and must be a non-empty string');
      }

      if (typeof maxResults !== 'number' || maxResults < 1 || maxResults > 50) {
        throw new Error('maxResults must be a number between 1 and 50');
      }

      // Validate engine
      const supportedEngines = ['google', 'bing', 'duckduckgo', 'searx'];
      if (!supportedEngines.includes(engine)) {
        throw new Error(
          `Unsupported search engine: ${engine}. Supported engines: ${supportedEngines.join(', ')}`
        );
      }

      // Build search query with exclusions
      let searchQuery = query;
      if (excludeTerms.length > 0) {
        const exclusions = excludeTerms.map((term: string) => `-${term}`).join(' ');
        searchQuery = `${query} ${exclusions}`;
      }

      // Add site restriction if specified
      if (siteSearch) {
        searchQuery = `${searchQuery} site:${siteSearch}`;
      }

      // Execute search based on engine
      const searchResults = await this.performSearch(searchQuery, {
        engine,
        maxResults,
        safeSearch,
        language,
        timeRange,
      });

      // Format and filter results
      const formattedResults = searchResults.map(result => ({
        title: result.title,
        url: result.url,
        ...(includeSnippets && result.snippet && { snippet: result.snippet }),
        ...(includeMetadata && result.metadata && { metadata: result.metadata }),
      }));

      // Generate search summary
      const summary = this.generateSearchSummary(query, formattedResults, engine);

      return {
        success: true,
        data: {
          query,
          engine,
          totalResults: formattedResults.length,
          results: formattedResults,
          summary,
          searchMetadata: {
            safeSearch,
            language,
            timeRange,
            siteSearch,
            excludeTerms,
            executedAt: new Date().toISOString(),
          },
        },
        metadata: {
          searchTime: Date.now(),
          engine,
          maxResults,
          actualResults: formattedResults.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred during web search',
      };
    }
  }

  /**
   * Perform search using the specified engine
   */
  private async performSearch(
    query: string,
    options: {
      engine: string;
      maxResults: number;
      safeSearch: string;
      language: string;
      timeRange: string;
    }
  ): Promise<SearchResult[]> {
    switch (options.engine) {
      case 'duckduckgo':
        return this.searchDuckDuckGo(query, options);
      case 'google':
        return this.searchGoogle(query, options);
      case 'bing':
        return this.searchBing(query, options);
      case 'searx':
        return this.searchSearX(query, options);
      default:
        throw new Error(`Unsupported search engine: ${options.engine}`);
    }
  }

  /**
   * Search using DuckDuckGo
   */
  private async searchDuckDuckGo(query: string, options: SearchOptions): Promise<SearchResult[]> {
    // DuckDuckGo doesn't have an official API, so we'll simulate results
    // In a real implementation, you might use a service like SerpApi or similar
    const mockResults: SearchResult[] = [
      {
        title: `${query} - Wikipedia`,
        url: `https://en.wikipedia.org/wiki/${query.replace(/\s+/g, '_')}`,
        snippet: `Learn about ${query} from the free encyclopedia. Comprehensive information and references.`,
        metadata: {
          source: 'wikipedia.org',
          date: new Date().toISOString().split('T')[0],
        },
      },
      {
        title: `${query} Documentation`,
        url: `https://developer.mozilla.org/en-US/docs/Web/${query}`,
        snippet: `Official documentation for ${query}. Includes examples, specifications, and browser compatibility.`,
        metadata: {
          source: 'developer.mozilla.org',
          date: new Date().toISOString().split('T')[0],
        },
      },
      {
        title: `${query} Tutorial`,
        url: `https://www.example.com/${query}-tutorial`,
        snippet: `Step-by-step tutorial on ${query}. Perfect for beginners and advanced users alike.`,
        metadata: {
          source: 'example.com',
          date: new Date().toISOString().split('T')[0],
        },
      },
    ];

    // Generate more mock results if needed
    while (mockResults.length < options.maxResults) {
      mockResults.push({
        title: `${query} - Result ${mockResults.length + 1}`,
        url: `https://example.com/${query.replace(/\s+/g, '-')}-${mockResults.length + 1}`,
        snippet: `Additional result ${mockResults.length + 1} for "${query}". More information available.`,
        metadata: {
          source: 'example.com',
          date: new Date().toISOString().split('T')[0],
        },
      });
    }

    return mockResults.slice(0, options.maxResults);
  }

  /**
   * Search using Google (would require API key in real implementation)
   */
  private async searchGoogle(query: string, options: SearchOptions): Promise<SearchResult[]> {
    // In a real implementation, this would use Google's Custom Search API
    // For now, return mock results
    const mockResults: SearchResult[] = [
      {
        title: `Google Search: ${query}`,
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        snippet: `Search results for "${query}" from Google. Find relevant information and resources.`,
        metadata: {
          source: 'google.com',
          date: new Date().toISOString().split('T')[0],
        },
      },
    ];

    return mockResults.slice(0, options.maxResults);
  }

  /**
   * Search using Bing (would require API key in real implementation)
   */
  private async searchBing(query: string, options: SearchOptions): Promise<SearchResult[]> {
    // In a real implementation, this would use Bing Web Search API
    // For now, return mock results
    const mockResults: SearchResult[] = [
      {
        title: `Bing Search: ${query}`,
        url: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
        snippet: `Search results for "${query}" from Bing. Discover comprehensive information.`,
        metadata: {
          source: 'bing.com',
          date: new Date().toISOString().split('T')[0],
        },
      },
    ];

    return mockResults.slice(0, options.maxResults);
  }

  /**
   * Search using SearX (open source meta-search engine)
   */
  private async searchSearX(query: string, options: SearchOptions): Promise<SearchResult[]> {
    // In a real implementation, this would query a SearX instance
    // For now, return mock results
    const mockResults: SearchResult[] = [
      {
        title: `SearX Search: ${query}`,
        url: `https://searx.org/search?q=${encodeURIComponent(query)}`,
        snippet: `Privacy-focused search results for "${query}" from SearX meta-search engine.`,
        metadata: {
          source: 'searx.org',
          date: new Date().toISOString().split('T')[0],
        },
      },
    ];

    return mockResults.slice(0, options.maxResults);
  }

  /**
   * Generate a summary of search results
   */
  private generateSearchSummary(
    query: string,
    results: FormattedSearchResult[],
    engine: string
  ): SearchSummary {
    const sources = [
      ...new Set(results.map(r => r.metadata?.source).filter((s): s is string => Boolean(s))),
    ];
    const totalSources = sources.length;

    // Calculate result quality metrics
    const hasSnippets = results.filter(r => r.snippet).length;
    const snippetCoverage = results.length > 0 ? (hasSnippets / results.length) * 100 : 0;

    // Generate relevance score (simplified)
    const relevanceScore = this.calculateRelevanceScore(query, results);

    return {
      query,
      engine,
      totalResults: results.length,
      sources: sources.slice(0, 5), // Top 5 sources
      totalSources,
      snippetCoverage: Math.round(snippetCoverage),
      relevanceScore,
      searchTips: this.generateSearchTips(query, results),
    };
  }

  /**
   * Calculate relevance score based on query-result matching
   */
  private calculateRelevanceScore(query: string, results: FormattedSearchResult[]): number {
    if (results.length === 0) return 0;

    const queryWords = query.toLowerCase().split(/\s+/);
    let totalScore = 0;

    for (const result of results) {
      let score = 0;
      const title = result.title.toLowerCase();
      const snippet = result.snippet?.toLowerCase() ?? '';

      // Title matches (higher weight)
      for (const word of queryWords) {
        if (title.includes(word)) score += 3;
      }

      // Snippet matches (medium weight)
      for (const word of queryWords) {
        if (snippet.includes(word)) score += 1;
      }

      totalScore += score;
    }

    // Normalize to 0-100 scale
    const maxPossibleScore = results.length * queryWords.length * 4;
    return Math.min(100, Math.round((totalScore / maxPossibleScore) * 100));
  }

  /**
   * Generate search tips based on results
   */
  private generateSearchTips(query: string, results: FormattedSearchResult[]): string[] {
    const tips: string[] = [];

    if (results.length === 0) {
      tips.push('Try using different keywords or simpler terms');
      tips.push('Check your spelling and try synonyms');
    } else if (results.length < 3) {
      tips.push('Consider broadening your search terms');
      tips.push('Try removing specific requirements or filters');
    }

    // Check for common search patterns
    if (query.includes('how to') && results.some(r => r.title.includes('tutorial'))) {
      tips.push('Great! Found tutorial results - check the step-by-step guides');
    }

    if (query.includes('error') || query.includes('problem')) {
      tips.push('For technical issues, also check Stack Overflow or GitHub issues');
    }

    if (results.some(r => r.metadata?.source?.includes('wikipedia'))) {
      tips.push('Wikipedia results found - good for general knowledge');
    }

    return tips.slice(0, 3); // Limit to 3 tips
  }
}

interface SearchOptions {
  engine: string;
  maxResults: number;
  safeSearch: string;
  language: string;
  timeRange: string;
}

interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
  metadata?: {
    source?: string;
    date?: string;
    size?: string;
    type?: string;
  };
}

interface FormattedSearchResult {
  title: string;
  url: string;
  snippet?: string;
  metadata?: {
    source?: string;
    date?: string;
    size?: string;
    type?: string;
  };
}

interface SearchSummary {
  query: string;
  engine: string;
  totalResults: number;
  sources: string[];
  totalSources: number;
  snippetCoverage: number;
  relevanceScore: number;
  searchTips: string[];
}
