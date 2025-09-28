import { Box, Text } from 'ink';
import { memo, useMemo } from 'react';
import { FlashyText } from '../FlashyText.js';
import { Message } from '../../types/index.js';
import { InteractiveLoading } from '../InteractiveLoading.js';
import { countTokens } from '../../utils/tokenUtils.js';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  isVerySmallScreen: boolean;
  showThinkingBlocks?: boolean;
  collapsedMessages?: Set<number>;
  onToggleCollapse?: (index: number) => void;
  scrollOffset?: number;
  maxVisibleMessages?: number;
}

const MessageList = memo(function MessageList({
  messages,
  isLoading,
  error,
  isVerySmallScreen,
  showThinkingBlocks: _showThinkingBlocks = true,
  collapsedMessages = new Set(),
  onToggleCollapse,
  scrollOffset = 0,
  maxVisibleMessages = 50,
}: MessageListProps) {
  // Use showThinkingBlocks for future thinking block display logic

  // Memoize token counts to avoid recalculating on every render
  const messageTokenCounts = useMemo(() => {
    return messages.map(message => countTokens(message.content || ''));
  }, [messages]);

  const renderedMessages = useMemo(() => {
    // Apply scrolling: show only messages within the visible range
    const startIndex = Math.max(0, messages.length - maxVisibleMessages - scrollOffset);
    const endIndex = messages.length - scrollOffset;
    const visibleMessages = messages.slice(startIndex, endIndex);

    return visibleMessages.map((message, visibleIndex) => {
      const actualIndex = startIndex + visibleIndex;
      // TODO: Implement thinking block display logic based on showThinkingBlocks
      // When thinking blocks are available in message, conditionally display them
      const displayContent = message.content || '';
      const tokenCount = messageTokenCounts[actualIndex];
      const isLargeMessage = tokenCount > 50000; // 50k tokens threshold
      const isCollapsed = collapsedMessages.has(actualIndex);

      // Handle message content based on size and collapse state
      let contentToShow = displayContent;
      let showExpandOption = false;

      if (isLargeMessage) {
        if (isCollapsed) {
          contentToShow =
            displayContent.substring(0, 200) +
            '\n\n[Message collapsed - ' +
            tokenCount.toLocaleString() +
            ' tokens total]';
          showExpandOption = true;
        } else {
          contentToShow = displayContent;
        }
      }

      return (
        <Box
          key={`${message.timestamp?.getTime() || actualIndex}-${tokenCount}`}
          marginBottom={isVerySmallScreen ? 0 : 1}
        >
          <FlashyText type="static">
            {isVerySmallScreen
              ? message.role === 'user'
                ? '👤 '
                : '🤖 '
              : message.role === 'user'
                ? '👤 '
                : '🤖 '}
          </FlashyText>
          <Text>{contentToShow}</Text>
          {showExpandOption && onToggleCollapse && (
            <Text color="cyan" dimColor>
              {'\n[Press Ctrl+E to expand this message]'}
            </Text>
          )}
        </Box>
      );
    });
  }, [
    messages,
    messageTokenCounts,
    collapsedMessages,
    isVerySmallScreen,
    onToggleCollapse,
    scrollOffset,
    maxVisibleMessages,
  ]);

  return (
    <Box flexDirection="column" flexGrow={1} marginBottom={isVerySmallScreen ? 0 : 1}>
      {renderedMessages}

      {isLoading && <InteractiveLoading />}

      {error && (
        <Box>
          <FlashyText type="static">{`🚨 Error: ${error}`}</FlashyText>
        </Box>
      )}
    </Box>
  );
});

export { MessageList };
