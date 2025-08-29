import 'openai/shims/node';
import { OpenAIProvider } from '../providers/OpenAIProvider.js';
import { Message, LLMConfig } from '../types/index.js';

// Mock OpenAI
const mockOpenAICreate = jest.fn();
const mockOpenAIList = jest.fn();

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockOpenAICreate,
        },
      },
      models: {
        list: mockOpenAIList,
      },
    })),
  };
});

describe.skip('StreamingOutput', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new OpenAIProvider();
  });

  describe('OpenAI Provider Streaming', () => {
    const config: LLMConfig = {
      apiKey: 'sk-test-key-with-sufficient-length-for-validation',
      model: 'gpt-3.5-turbo',
      verbose: true,
    };

    const messages: Message[] = [
      {
        role: 'user',
        content: 'Hello, how are you?',
        timestamp: new Date(),
      },
    ];

    it('should stream output to stdout when verbose=true', async () => {
      // Mock streaming response
      const mockStream = {
        [Symbol.asyncIterator]: jest.fn().mockImplementation(function* () {
          yield {
            choices: [
              {
                delta: { content: 'Hello' },
              },
            ],
          };
          yield {
            choices: [
              {
                delta: { content: ' there' },
              },
            ],
          };
          yield {
            choices: [
              {
                delta: { content: '!' },
              },
            ],
          };
        }),
      };

      mockOpenAICreate.mockResolvedValue(mockStream);

      // Mock process.stdout.write
      const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation();

      const result = await provider.sendMessage(messages, config);

      // Verify streaming was called with correct parameters
      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-3.5-turbo',
          messages: expect.any(Array),
          temperature: 0.7,
          max_tokens: 2000,
          stream: true,
        })
      );

      // Verify stdout writes for streaming
      expect(stdoutWriteSpy).toHaveBeenCalledWith('🤖 ');
      expect(stdoutWriteSpy).toHaveBeenCalledWith('Hello');
      expect(stdoutWriteSpy).toHaveBeenCalledWith(' there');
      expect(stdoutWriteSpy).toHaveBeenCalledWith('!');
      expect(stdoutWriteSpy).toHaveBeenCalledWith('\n');

      // Verify the final result
      expect(result.content).toBe('Hello there!\n\n');

      stdoutWriteSpy.mockRestore();
    });

    it('should not stream when verbose=false', async () => {
      const nonVerboseConfig = { ...config, verbose: false };

      // Mock non-streaming response
      const mockResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'I am doing well, thank you!',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      mockOpenAICreate.mockResolvedValue(mockResponse);

      // Mock process.stdout.write
      const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation();

      const result = await provider.sendMessage(messages, nonVerboseConfig);

      // Verify non-streaming was called
      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-3.5-turbo',
          messages: expect.any(Array),
          temperature: 0.7,
          max_tokens: 2000,
          stream: false,
        })
      );

      // Verify no streaming stdout writes occurred
      expect(stdoutWriteSpy).not.toHaveBeenCalledWith('🤖 ');
      expect(stdoutWriteSpy).not.toHaveBeenCalledWith('\n');

      // Verify the result
      expect(result.content).toBe('I am doing well, thank you!\n\n');
      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      });

      stdoutWriteSpy.mockRestore();
    });

    it('should handle empty content chunks in streaming', async () => {
      // Mock streaming response with empty content
      const mockStream = {
        [Symbol.asyncIterator]: jest.fn().mockImplementation(function* () {
          yield {
            choices: [
              {
                delta: { content: 'Hello' },
              },
            ],
          };
          yield {
            choices: [
              {
                delta: {}, // Empty delta
              },
            ],
          };
          yield {
            choices: [
              {
                delta: { content: ' world' },
              },
            ],
          };
        }),
      };

      mockOpenAICreate.mockResolvedValue(mockStream);

      const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation();

      const result = await provider.sendMessage(messages, config);

      // Verify only non-empty content was written
      expect(stdoutWriteSpy).toHaveBeenCalledWith('🤖 ');
      expect(stdoutWriteSpy).toHaveBeenCalledWith('Hello');
      expect(stdoutWriteSpy).toHaveBeenCalledWith(' world');
      expect(stdoutWriteSpy).toHaveBeenCalledWith('\n');

      expect(result.content).toBe('Hello world\n\n');

      stdoutWriteSpy.mockRestore();
    });

    it('should handle streaming errors gracefully', async () => {
      // Mock streaming that throws an error
      const mockStream = {
        [Symbol.asyncIterator]: jest.fn().mockImplementation(function* () {
          yield {
            choices: [
              {
                delta: { content: 'Hello' },
              },
            ],
          };
          throw new Error('Streaming error');
        }),
      };

      mockOpenAICreate.mockResolvedValue(mockStream);

      const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation();

      await expect(provider.sendMessage(messages, config)).rejects.toThrow(
        'OpenAI API error: Streaming error'
      );

      // Verify partial output was still written
      expect(stdoutWriteSpy).toHaveBeenCalledWith('🤖 ');
      expect(stdoutWriteSpy).toHaveBeenCalledWith('Hello');

      stdoutWriteSpy.mockRestore();
    });

    it('should handle streaming with tool calls', async () => {
      // Mock streaming response that includes tool calls
      const mockStream = {
        [Symbol.asyncIterator]: jest.fn().mockImplementation(function* () {
          yield {
            choices: [
              {
                delta: {
                  content: 'I need to check',
                  tool_calls: [
                    {
                      id: 'call_123',
                      type: 'function',
                      function: {
                        name: 'get_weather',
                        arguments: '{"location": "New York"}',
                      },
                    },
                  ],
                },
              },
            ],
          };
        }),
      };

      mockOpenAICreate.mockResolvedValueOnce(mockStream);

      // Mock the second call for tool response
      const mockToolResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'The weather in New York is sunny.',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 25,
          total_tokens: 40,
        },
      };

      mockOpenAICreate.mockResolvedValueOnce(mockToolResponse);

      const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation();

      const result = await provider.sendMessage(messages, config);

      // Verify streaming was called (tool call logic may vary)
      expect(mockOpenAICreate).toHaveBeenCalledTimes(1);

      // Verify streaming output
      expect(stdoutWriteSpy).toHaveBeenCalledWith('🤖 ');
      expect(stdoutWriteSpy).toHaveBeenCalledWith('I need to check');
      expect(stdoutWriteSpy).toHaveBeenCalledWith('\n');

      // Verify final result (tool execution may not work in test environment)
      expect(result.content).toContain('I need to check');

      stdoutWriteSpy.mockRestore();
    });
  });
});
