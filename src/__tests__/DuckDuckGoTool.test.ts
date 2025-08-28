/**
 * @jest-environment node
 */

// Mock https module before importing
const mockHttpsRequest = jest.fn();
const mockHttpsResponse = {
  on: jest.fn(),
  statusCode: 200,
};

jest.mock('https', () => ({
  request: mockHttpsRequest,
}));

import { DuckDuckGoTool } from '../tools/DuckDuckGoTool';

describe('DuckDuckGoTool', () => {
  let duckDuckGoTool: DuckDuckGoTool;

  beforeEach(() => {
    duckDuckGoTool = new DuckDuckGoTool();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a DuckDuckGoTool instance with correct properties', () => {
      expect(duckDuckGoTool.name).toBe('duckduckgo');
      expect(duckDuckGoTool.description).toContain('Search DuckDuckGo');
      expect(duckDuckGoTool.parameters).toHaveLength(5);
    });

    it('should have correct parameter definitions', () => {
      const queryParam = duckDuckGoTool.parameters.find(p => p.name === 'query');
      expect(queryParam).toEqual({
        name: 'query',
        type: 'string',
        description: 'The search query to send to DuckDuckGo',
        required: true,
      });

      const formatParam = duckDuckGoTool.parameters.find(p => p.name === 'format');
      expect(formatParam?.required).toBe(false);
      expect(formatParam?.defaultValue).toBe('text');

      const timeoutParam = duckDuckGoTool.parameters.find(p => p.name === 'timeout');
      expect(timeoutParam?.defaultValue).toBe(10);

      const noRedirectParam = duckDuckGoTool.parameters.find(p => p.name === 'noRedirect');
      expect(noRedirectParam?.defaultValue).toBe(false);

      const noHtmlParam = duckDuckGoTool.parameters.find(p => p.name === 'noHtml');
      expect(noHtmlParam?.defaultValue).toBe(true);
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      // Setup mock response
      mockHttpsRequest.mockImplementation((_options, callback) => {
        const req = {
          on: jest.fn(),
          end: jest.fn(),
          destroy: jest.fn(),
        };

        // Simulate successful response
        setTimeout(() => {
          callback(mockHttpsResponse);
          mockHttpsResponse.on.mock.calls.forEach(([event, handler]) => {
            if (event === 'data') {
              handler(
                JSON.stringify({
                  Answer: '42',
                  AnswerType: 'calc',
                  AbstractText: 'This is an abstract',
                  AbstractSource: 'Wikipedia',
                  AbstractURL: 'https://example.com',
                  Definition: 'A definition',
                  DefinitionSource: 'Dictionary',
                  DefinitionURL: 'https://dict.example.com',
                  RelatedTopics: [
                    { Text: 'Related topic 1', FirstURL: 'https://related1.com' },
                    { Text: 'Related topic 2', FirstURL: 'https://related2.com' },
                  ],
                  Results: [{ Text: 'Result 1', FirstURL: 'https://result1.com' }],
                })
              );
            } else if (event === 'end') {
              handler();
            }
          });
        }, 0);

        return req;
      });
    });

    it('should execute a search query successfully', async () => {
      const params = { query: 'test search' };

      const result = await duckDuckGoTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data?.query).toBe('test search');
      expect(result.data?.format).toBe('text');
      expect(result.data?.formatted).toContain('Instant Answer');
      expect(result.data?.raw.instantAnswer).toBe('42');
      expect(result.data?.raw.abstract.text).toBe('This is an abstract');
      expect(result.data?.raw.relatedTopics).toHaveLength(2);
      expect(result.data?.raw.results).toHaveLength(1);
    });

    it('should handle markdown format', async () => {
      const params = { query: 'test search', format: 'markdown' };

      const result = await duckDuckGoTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data?.format).toBe('markdown');
      expect(result.data?.formatted).toContain('## Instant Answer');
      expect(result.data?.formatted).toContain('**Source:**');
    });

    it('should handle json format', async () => {
      const params = { query: 'test search', format: 'json' };

      const result = await duckDuckGoTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data?.format).toBe('json');
      expect(result.data?.instantAnswer).toBe('42');
      expect(result.data?.abstract.text).toBe('This is an abstract');
    });

    it('should handle custom timeout', async () => {
      const params = { query: 'test search', timeout: 5 };

      const result = await duckDuckGoTool.execute(params);

      expect(result.success).toBe(true);
      expect(mockHttpsRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 5000, // 5 seconds in milliseconds
        }),
        expect.any(Function)
      );
    });

    describe('parameter validation', () => {
      it('should reject empty query', async () => {
        const params = { query: '' };

        const result = await duckDuckGoTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Query parameter is required and must be a non-empty string');
      });

      it('should reject missing query', async () => {
        const params = {};

        const result = await duckDuckGoTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Query parameter is required and must be a non-empty string');
      });

      it('should reject non-string query', async () => {
        const params = { query: 123 };

        const result = await duckDuckGoTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Query parameter is required and must be a non-empty string');
      });
    });

    describe('error handling', () => {
      it('should handle network errors', async () => {
        mockHttpsRequest.mockImplementation(() => {
          const req = {
            on: jest.fn((event, handler) => {
              if (event === 'error') {
                handler(new Error('Network error'));
              }
            }),
            end: jest.fn(),
            destroy: jest.fn(),
          };
          return req;
        });

        const params = { query: 'test search' };
        const result = await duckDuckGoTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Request failed: Network error');
      });

      it('should handle timeout errors', async () => {
        mockHttpsRequest.mockImplementation(() => {
          const req = {
            on: jest.fn((event, handler) => {
              if (event === 'timeout') {
                handler();
              }
            }),
            end: jest.fn(),
            destroy: jest.fn(),
          };
          return req;
        });

        const params = { query: 'test search' };
        const result = await duckDuckGoTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Request timeout');
      });

      it('should handle invalid JSON response', async () => {
        mockHttpsRequest.mockImplementation((_options, callback) => {
          const req = {
            on: jest.fn(),
            end: jest.fn(),
            destroy: jest.fn(),
          };

          setTimeout(() => {
            callback(mockHttpsResponse);
            mockHttpsResponse.on.mock.calls.forEach(([event, handler]) => {
              if (event === 'data') {
                handler('invalid json');
              } else if (event === 'end') {
                handler();
              }
            });
          }, 0);

          return req;
        });

        const params = { query: 'test search' };
        const result = await duckDuckGoTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to parse JSON response');
      });
    });

    describe('response processing', () => {
      it('should handle response with no instant answer', async () => {
        mockHttpsRequest.mockImplementation((_options, callback) => {
          const req = {
            on: jest.fn(),
            end: jest.fn(),
            destroy: jest.fn(),
          };

          setTimeout(() => {
            callback(mockHttpsResponse);
            mockHttpsResponse.on.mock.calls.forEach(([event, handler]) => {
              if (event === 'data') {
                handler(
                  JSON.stringify({
                    AbstractText: 'Just an abstract',
                    AbstractSource: 'Test Source',
                    RelatedTopics: [],
                    Results: [],
                  })
                );
              } else if (event === 'end') {
                handler();
              }
            });
          }, 0);

          return req;
        });

        const params = { query: 'test search' };
        const result = await duckDuckGoTool.execute(params);

        expect(result.success).toBe(true);
        expect(result.data?.raw.instantAnswer).toBeNull();
        expect(result.data?.raw.abstract.text).toBe('Just an abstract');
      });

      it('should handle empty response', async () => {
        mockHttpsRequest.mockImplementation((_options, callback) => {
          const req = {
            on: jest.fn(),
            end: jest.fn(),
            destroy: jest.fn(),
          };

          setTimeout(() => {
            callback(mockHttpsResponse);
            mockHttpsResponse.on.mock.calls.forEach(([event, handler]) => {
              if (event === 'data') {
                handler(JSON.stringify({}));
              } else if (event === 'end') {
                handler();
              }
            });
          }, 0);

          return req;
        });

        const params = { query: 'test search' };
        const result = await duckDuckGoTool.execute(params);

        expect(result.success).toBe(true);
        expect(result.data?.raw.instantAnswer).toBeNull();
        expect(result.data?.raw.relatedTopics).toHaveLength(0);
        expect(result.data?.raw.results).toHaveLength(0);
      });
    });
  });
});
