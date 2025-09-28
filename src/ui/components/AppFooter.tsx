import { Box } from 'ink';
import { FlashyText } from '../FlashyText.js';

interface AppFooterProps {
  messagesLength: number;
  isVerySmallScreen: boolean;
  isSmallScreen: boolean;
  totalTokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  scrollOffset?: number;
  maxVisibleMessages?: number;
}

export function AppFooter({
  messagesLength,
  isVerySmallScreen,
  isSmallScreen,
  totalTokenUsage,
  scrollOffset = 0,
  maxVisibleMessages = 20,
}: AppFooterProps) {
  // Only show footer if there are messages or not on very small screen
  if (messagesLength === 0 && isVerySmallScreen) {
    return null;
  }

  const formatTokenUsage = () => {
    if (!totalTokenUsage || totalTokenUsage.totalTokens === 0) return null;

    if (isVerySmallScreen) {
      return `Tokens: ${totalTokenUsage.totalTokens.toLocaleString()}`;
    }

    if (isSmallScreen) {
      return `Tokens: ${totalTokenUsage.totalTokens.toLocaleString()} (${totalTokenUsage.promptTokens.toLocaleString()}/${totalTokenUsage.completionTokens.toLocaleString()})`;
    }

    return `Token Usage: ${totalTokenUsage.totalTokens.toLocaleString()} total (${totalTokenUsage.promptTokens.toLocaleString()} prompt + ${totalTokenUsage.completionTokens.toLocaleString()} completion)`;
  };

  const tokenUsageText = formatTokenUsage();

  const scrollInfo = () => {
    if (messagesLength <= maxVisibleMessages || scrollOffset === 0) return null;

    const totalScrollable = Math.max(0, messagesLength - maxVisibleMessages);
    const currentPosition = totalScrollable - scrollOffset;

    if (isVerySmallScreen) {
      return `↑${currentPosition}/${totalScrollable}`;
    }

    return `Scrolled: ${currentPosition}/${totalScrollable} messages (Ctrl+↑↓ to scroll)`;
  };

  const scrollText = scrollInfo();

  return (
    <Box marginTop={isVerySmallScreen ? 2 : isSmallScreen ? 2 : 1}>
      {isVerySmallScreen ? (
        <>
          <FlashyText type="static">Enter send • Ctrl+C exit</FlashyText>
          {tokenUsageText && (
            <FlashyText type="static" speed={400} colors={['cyan', 'white']}>
              {tokenUsageText}
            </FlashyText>
          )}
        </>
      ) : (
        <>
          <FlashyText type="static">
            {isSmallScreen
              ? 'Enter to send, Ctrl+C to exit'
              : 'Type your message and press Enter to send, Ctrl+C to exit'}
          </FlashyText>
          {tokenUsageText && <FlashyText type="static">{tokenUsageText}</FlashyText>}
          {scrollText && (
            <FlashyText type="static" speed={400} colors={['yellow', 'white']}>
              {scrollText}
            </FlashyText>
          )}
          {!isSmallScreen && messagesLength === 0 && (
            <FlashyText type="static">
              Commands: /verbose (toggle), /clear (clear), /compress (summarize), /themes (switch),
              /mode (toggle) | Tab to toggle mode | ↑↓ for history
            </FlashyText>
          )}
        </>
      )}
    </Box>
  );
}
