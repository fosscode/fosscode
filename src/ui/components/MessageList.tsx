import { Box, Text } from 'ink';
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
}

export function MessageList({
  messages,
  isLoading,
  error,
  isVerySmallScreen,
  showThinkingBlocks: _showThinkingBlocks = true,
  collapsedMessages = new Set(),
  onToggleCollapse,
}: MessageListProps) {
  // Use showThinkingBlocks for future thinking block display logic

  const renderedMessages = messages.map((message, index) => {
    // TODO: Implement thinking block display logic based on showThinkingBlocks
    // When thinking blocks are available in message, conditionally display them
    const displayContent = message.content || '';
    const tokenCount = countTokens(displayContent);
    const isLargeMessage = tokenCount > 50000; // 50k tokens threshold
    const isCollapsed = collapsedMessages.has(index);

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

    // Disable animations for large content to prevent flickering
    const shouldAnimate = !isLargeMessage;

    return (
      <Box key={index} marginBottom={isVerySmallScreen ? 0 : 1}>
        <FlashyText
          type={shouldAnimate ? 'static' : 'static'}
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
        <Text>{contentToShow}</Text>
        {showExpandOption && onToggleCollapse && (
          <Text color="cyan" dimColor>
            {'\n[Press Ctrl+E to expand this message]'}
          </Text>
        )}
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
