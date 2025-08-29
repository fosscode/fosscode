import { Box, Text } from 'ink';
import { FlashyText } from '../FlashyText.js';
import { Message } from '../../types/index.js';
import { InteractiveLoading } from '../InteractiveLoading.js';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  isVerySmallScreen: boolean;
}

export function MessageList({ messages, isLoading, error, isVerySmallScreen }: MessageListProps) {
  const renderedMessages = messages.map((message, index) => (
    <Box key={index} marginBottom={isVerySmallScreen ? 0 : 1}>
      <FlashyText
        type={message.role === 'user' ? 'pulse' : 'wave'}
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
      <Text>{message.content}</Text>
    </Box>
  ));

  return (
    <Box flexDirection="column" flexGrow={1} marginBottom={isVerySmallScreen ? 0 : 1}>
      {renderedMessages}

      {isLoading && <InteractiveLoading />}

      {error && (
        <Box>
          <FlashyText type="static" speed={150} colors={['red', 'orange', 'yellow']}>
            {`🚨 Error: ${error}`}
          </FlashyText>
        </Box>
      )}
    </Box>
  );
}
