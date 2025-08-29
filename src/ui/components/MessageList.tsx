import { Box, Text } from 'ink';
import { FlashyText } from '../FlashyText.js';
import { Message } from '../../types/index.js';
import { InteractiveLoading } from '../InteractiveLoading.js';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  isVerySmallScreen: boolean;
  showThinkingBlocks?: boolean;
}

export function MessageList({
  messages,
  isLoading,
  error,
  isVerySmallScreen,
  showThinkingBlocks = true,
}: MessageListProps) {
  // Use showThinkingBlocks for future thinking block display logic
  console.log('Thinking blocks display:', showThinkingBlocks);

  const renderedMessages = messages.map((message, index) => {
    // TODO: Implement thinking block display logic based on showThinkingBlocks
    // When thinking blocks are available in message, conditionally display them
    const displayContent = message.content || '';

    return (
      <Box key={index} marginBottom={isVerySmallScreen ? 0 : 1}>
        <FlashyText
          type="static"
          speed={message.role === 'user' ? 400 : 200}
          colors={
            message.role === 'user'
              ? ['green', 'lime', 'cyan']
              : ['blue', 'cyan', 'magenta', 'yellow']
          }
        >
          {isVerySmallScreen
            ? message.role === 'user'
              ? '👤 '
              : '🤖 '
            : message.role === 'user'
              ? '👤 '
              : '🤖 '}
        </FlashyText>
        <Text>{displayContent}</Text>
      </Box>
    );
  });

  return (
    <Box flexDirection="column" flexGrow={1} marginBottom={isVerySmallScreen ? 0 : 1}>
      {renderedMessages}

      {isLoading && <InteractiveLoading />}

      {error && (
        <Box>
          <FlashyText type="static" speed={150} colors={['orange', 'yellow', 'green']}>
            {`🚨 Error: ${error}`}
          </FlashyText>
        </Box>
      )}
    </Box>
  );
}
