import { WebSearchTool } from '../tools/WebSearchTool.js';

describe('WebSearchTool', () => {
  let webSearchTool: WebSearchTool;

  beforeEach(() => {
    webSearchTool = new WebSearchTool();
  });

  describe('basic functionality', () => {
    it('should have correct name and description', () => {
      expect(webSearchTool.name).toBe('web-search');
      expect(webSearchTool.description).toContain('web searches');
    });

    it('should have required parameters', () => {
      expect(webSearchTool.parameters).toHaveLength(10);
      const queryParam = webSearchTool.parameters.find(p => p.name === 'query');
      expect(queryParam?.required).toBe(true);
      expect(queryParam?.type).toBe('string');
    });

    it('should have optional parameters with defaults', () => {
      const engineParam = webSearchTool.parameters.find(p => p.name === 'engine');
      const maxResultsParam = webSearchTool.parameters.find(p => p.name === 'maxResults');
      const safeSearchParam = webSearchTool.parameters.find(p => p.name === 'safeSearch');

      expect(engineParam?.defaultValue).toBe('duckduckgo');
      expect(maxResultsParam?.defaultValue).toBe(10);
      expect(safeSearchParam?.defaultValue).toBe('moderate');
    });
  });

  describe('execute method validation', () => {
    it('should return error for missing query', async () => {
      const result = await webSearchTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Query parameter is required');
    });

    it('should return error for empty query', async () => {
      const result = await webSearchTool.execute({ query: '' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Query parameter is required');
    });

    it('should return error for invalid query type', async () => {
      const result = await webSearchTool.execute({ query: 123 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Query parameter is required');
    });

    it('should return error for invalid maxResults', async () => {
      const result = await webSearchTool.execute({
        query: 'test',
        maxResults: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('maxResults must be a number between 1 and 50');
    });

    it('should return error for maxResults too high', async () => {
      const result = await webSearchTool.execute({
        query: 'test',
        maxResults: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('maxResults must be a number between 1 and 50');
    });

    it('should return error for unsupported engine', async () => {
      const result = await webSearchTool.execute({
        query: 'test',
        engine: 'unsupported',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported search engine');
    });
  });

  describe('search execution', () => {
    it('should execute DuckDuckGo search successfully', async () => {
      const result = await webSearchTool.execute({
        query: 'test query',
        engine: 'duckduckgo',
        maxResults: 3,
      });

      expect(result.success).toBe(true);
      expect(result.data?.query).toBe('test query');
      expect(result.data?.engine).toBe('duckduckgo');
      expect(result.data?.totalResults).toBeGreaterThan(0);
      expect(result.data?.results).toHaveLength(3);
    });

    it('should execute Google search successfully', async () => {
      const result = await webSearchTool.execute({
        query: 'test query',
        engine: 'google',
        maxResults: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data?.engine).toBe('google');
      expect(result.data?.results).toHaveLength(1);
    });

    it('should execute Bing search successfully', async () => {
      const result = await webSearchTool.execute({
        query: 'test query',
        engine: 'bing',
        maxResults: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data?.engine).toBe('bing');
      expect(result.data?.results).toHaveLength(1);
    });

    it('should execute SearX search successfully', async () => {
      const result = await webSearchTool.execute({
        query: 'test query',
        engine: 'searx',
        maxResults: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data?.engine).toBe('searx');
      expect(result.data?.results).toHaveLength(1);
    });

    it('should include snippets when requested', async () => {
      const result = await webSearchTool.execute({
        query: 'test',
        includeSnippets: true,
        maxResults: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data?.results[0].snippet).toBeDefined();
    });

    it('should exclude snippets when disabled', async () => {
      const result = await webSearchTool.execute({
        query: 'test',
        includeSnippets: false,
        maxResults: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data?.results[0].snippet).toBeUndefined();
    });

    it('should include metadata when requested', async () => {
      const result = await webSearchTool.execute({
        query: 'test',
        includeMetadata: true,
        maxResults: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data?.results[0].metadata).toBeDefined();
    });

    it('should exclude metadata when disabled', async () => {
      const result = await webSearchTool.execute({
        query: 'test',
        includeMetadata: false,
        maxResults: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data?.results[0].metadata).toBeUndefined();
    });
  });

  describe('query processing', () => {
    it('should handle exclude terms', async () => {
      const result = await webSearchTool.execute({
        query: 'javascript tutorial',
        excludeTerms: ['jquery', 'react'],
        maxResults: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data?.searchMetadata?.excludeTerms).toEqual(['jquery', 'react']);
    });

    it('should handle site search restriction', async () => {
      const result = await webSearchTool.execute({
        query: 'api documentation',
        siteSearch: 'developer.mozilla.org',
        maxResults: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data?.searchMetadata?.siteSearch).toBe('developer.mozilla.org');
    });

    it('should handle multiple search options', async () => {
      const result = await webSearchTool.execute({
        query: 'web development',
        engine: 'duckduckgo',
        maxResults: 5,
        safeSearch: 'strict',
        language: 'en',
        timeRange: 'week',
        includeSnippets: true,
        includeMetadata: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.engine).toBe('duckduckgo');
      expect(result.data?.totalResults).toBe(5);
      expect(result.data?.searchMetadata?.safeSearch).toBe('strict');
      expect(result.data?.searchMetadata?.language).toBe('en');
      expect(result.data?.searchMetadata?.timeRange).toBe('week');
    });
  });

  describe('result formatting', () => {
    it('should format results with all fields', async () => {
      const result = await webSearchTool.execute({
        query: 'test',
        includeSnippets: true,
        includeMetadata: true,
        maxResults: 2,
      });

      expect(result.success).toBe(true);
      expect(result.data?.results).toHaveLength(2);

      const firstResult = result.data?.results[0];
      expect(firstResult?.title).toBeDefined();
      expect(firstResult?.url).toBeDefined();
      expect(firstResult?.snippet).toBeDefined();
      expect(firstResult?.metadata).toBeDefined();
      expect(firstResult?.metadata?.source).toBeDefined();
    });

    it('should generate search summary', async () => {
      const result = await webSearchTool.execute({
        query: 'test query',
        maxResults: 3,
      });

      expect(result.success).toBe(true);
      expect(result.data?.summary).toBeDefined();
      expect(result.data?.summary?.query).toBe('test query');
      expect(result.data?.summary?.totalResults).toBe(3);
      expect(result.data?.summary?.sources).toBeDefined();
      expect(result.data?.summary?.relevanceScore).toBeDefined();
    });
  });

  describe('search summary features', () => {
    it('should calculate relevance score', async () => {
      const result = await webSearchTool.execute({
        query: 'javascript tutorial',
        maxResults: 3,
      });

      expect(result.success).toBe(true);
      expect(result.data?.summary?.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(result.data?.summary?.relevanceScore).toBeLessThanOrEqual(100);
    });

    it('should generate search tips', async () => {
      const result = await webSearchTool.execute({
        query: 'test',
        maxResults: 3,
      });

      expect(result.success).toBe(true);
      expect(result.data?.summary?.searchTips).toBeDefined();
      expect(Array.isArray(result.data?.summary?.searchTips)).toBe(true);
    });

    it('should track snippet coverage', async () => {
      const result = await webSearchTool.execute({
        query: 'test',
        includeSnippets: true,
        maxResults: 3,
      });

      expect(result.success).toBe(true);
      expect(result.data?.summary?.snippetCoverage).toBeDefined();
      expect(result.data?.summary?.snippetCoverage).toBeGreaterThanOrEqual(0);
      expect(result.data?.summary?.snippetCoverage).toBeLessThanOrEqual(100);
    });
  });

  describe('error handling', () => {
    it('should handle network-like errors gracefully', async () => {
      // Mock a search engine that might fail
      const tool = webSearchTool as any;

      // Temporarily replace the search method to simulate failure
      const originalSearch = tool.performSearch;
      tool.performSearch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await webSearchTool.execute({
        query: 'test query',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');

      // Restore original method
      tool.performSearch = originalSearch;
    });
  });

  describe('edge cases', () => {
    it('should handle very short queries', async () => {
      const result = await webSearchTool.execute({
        query: 'a',
        maxResults: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data?.results).toHaveLength(1);
    });

    it('should handle queries with special characters', async () => {
      const result = await webSearchTool.execute({
        query: 'C++ programming & web development',
        maxResults: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data?.results).toHaveLength(1);
    });

    it('should handle empty exclude terms array', async () => {
      const result = await webSearchTool.execute({
        query: 'test',
        excludeTerms: [],
        maxResults: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data?.searchMetadata?.excludeTerms).toEqual([]);
    });
  });
});
