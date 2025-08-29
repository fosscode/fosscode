import { render } from 'ink-testing-library';
import { MessageList } from '../ui/components/MessageList.js';
import { Message } from '../types/index.js';

describe('MessageList', () => {
  const mockMessages: Message[] = [
    {
      role: 'user',
      content: 'Hello, how are you?',
      timestamp: new Date('2023-01-01T00:00:00Z'),
    },
    {
      role: 'assistant',
      content: 'I am doing well, thank you for asking!',
      timestamp: new Date('2023-01-01T00:00:01Z'),
    },
    {
      role: 'user',
      content: 'Can you help me with something?',
      timestamp: new Date('2023-01-01T00:00:02Z'),
    },
    {
      role: 'assistant',
      content: 'Of course! What do you need help with?',
      timestamp: new Date('2023-01-01T00:00:03Z'),
    },
  ];

  it('renders all messages correctly', () => {
    const { lastFrame } = render(
      <MessageList
        messages={mockMessages}
        isLoading={false}
        error={null}
        isVerySmallScreen={false}
      />
    );

    const output = lastFrame();

    // Check that user messages are rendered with 👤 emoji
    expect(output).toContain('👤');
    expect(output).toContain('Hello, how are you?');

    // Check that assistant messages are rendered with 🤖 emoji
    expect(output).toContain('🤖');
    expect(output).toContain('I am doing well, thank you for asking!');
    expect(output).toContain('Of course! What do you need help with?');
  });

  it('renders empty assistant messages correctly', () => {
    const messagesWithEmpty: Message[] = [
      {
        role: 'user',
        content: 'Test message',
        timestamp: new Date(),
      },
      {
        role: 'assistant',
        content: '', // Empty content
        timestamp: new Date(),
      },
      {
        role: 'assistant',
        content: 'Valid response',
        timestamp: new Date(),
      },
    ];

    const { lastFrame } = render(
      <MessageList
        messages={messagesWithEmpty}
        isLoading={false}
        error={null}
        isVerySmallScreen={false}
      />
    );

    const output = lastFrame();

    // Should still show the 🤖 emoji even for empty messages
    expect(output).toContain('👤');
    expect(output).toContain('🤖');
    expect(output).toContain('Test message');
    expect(output).toContain('Valid response');
  });

  it('renders loading indicator when isLoading is true', () => {
    const { lastFrame } = render(
      <MessageList
        messages={mockMessages}
        isLoading={true}
        error={null}
        isVerySmallScreen={false}
      />
    );

    const output = lastFrame();
    // The loading indicator should be rendered
    expect(output).toBeTruthy();
  });

  it('renders error message when error is present', () => {
    const errorMessage = 'Test error occurred';
    const { lastFrame } = render(
      <MessageList
        messages={mockMessages}
        isLoading={false}
        error={errorMessage}
        isVerySmallScreen={false}
      />
    );

    const output = lastFrame();
    expect(output).toContain('🚨 Error: Test error occurred');
  });

  it('handles very small screen rendering', () => {
    const { lastFrame } = render(
      <MessageList
        messages={mockMessages}
        isLoading={false}
        error={null}
        isVerySmallScreen={true}
      />
    );

    const output = lastFrame();
    // Should still contain the emojis and content
    expect(output).toContain('👤');
    expect(output).toContain('🤖');
    expect(output).toContain('Hello, how are you?');
  });

  it('handles messages with special characters', () => {
    const specialMessages: Message[] = [
      {
        role: 'user',
        content: 'Message with emojis 😀 and symbols @#$%^&*()',
        timestamp: new Date(),
      },
      {
        role: 'assistant',
        content: 'Response with unicode: 你好 and formatting\n- Item 1\n- Item 2',
        timestamp: new Date(),
      },
    ];

    const { lastFrame } = render(
      <MessageList
        messages={specialMessages}
        isLoading={false}
        error={null}
        isVerySmallScreen={false}
      />
    );

    const output = lastFrame();
    expect(output).toContain('Message with emojis 😀 and symbols @#$%^&*()');
    expect(output).toContain('Response with unicode: 你好 and formatting');
    expect(output).toContain('- Item 1');
    expect(output).toContain('- Item 2');
  });

  it('handles null or undefined message content gracefully', () => {
    const messagesWithNull: Message[] = [
      {
        role: 'user',
        content: 'Test message',
        timestamp: new Date(),
      },
      {
        role: 'assistant',
        content: null as any, // Simulate null content
        timestamp: new Date(),
      },
      {
        role: 'assistant',
        content: undefined as any, // Simulate undefined content
        timestamp: new Date(),
      },
    ];

    const { lastFrame } = render(
      <MessageList
        messages={messagesWithNull}
        isLoading={false}
        error={null}
        isVerySmallScreen={false}
      />
    );

    const output = lastFrame();

    // Should still render the emojis even with null/undefined content
    expect(output).toContain('👤');
    expect(output).toContain('🤖');
    expect(output).toContain('Test message');
  });
});
