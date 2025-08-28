import { useMemo } from 'react';
import { Box, Text } from 'ink';
import { Message } from '../types/index.js';

interface MessageListProps {
  messages: Message[];
  themeColors: {
    userMessage: string;
    assistantMessage: string;
  };
  isVerySmallScreen: boolean;
}

export function MessageList({ messages, themeColors, isVerySmallScreen }: MessageListProps) {
  const renderedMessages = useMemo(
    () =>
      messages.map((message, index) => (
        <Box key={index} marginBottom={isVerySmallScreen ? 0 : 1}>
          <Text
            color={message.role === 'user' ? themeColors.userMessage : themeColors.assistantMessage}
          >
            {isVerySmallScreen
              ? message.role === 'user'
                ? '👤 '
                : '🤖 '
              : message.role === 'user'
                ? '👤 '
                : '🤖 '}
          </Text>
          <Text>{message.content}</Text>
        </Box>
      )),
    [messages, themeColors, isVerySmallScreen]
  );

  return <>{renderedMessages}</>;
}
