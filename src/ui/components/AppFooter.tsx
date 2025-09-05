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
}

export function AppFooter({
  messagesLength,
  isVerySmallScreen,
  isSmallScreen,
  totalTokenUsage,
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

  return (
    <Box marginTop={isVerySmallScreen ? 2 : isSmallScreen ? 2 : 1}>
      {isVerySmallScreen ? (
        <>
          <FlashyText type="static" speed={400} colors={['gray', 'white']}>
            Enter send • Ctrl+C exit
          </FlashyText>
          {tokenUsageText && (
            <FlashyText type="static" speed={400} colors={['cyan', 'white']}>
              {tokenUsageText}
            </FlashyText>
          )}
        </>
      ) : (
        <>
          <FlashyText type="static" speed={400} colors={['gray', 'white']}>
            {isSmallScreen
              ? 'Enter to send, Ctrl+C to exit'
              : 'Type your message and press Enter to send, Ctrl+C to exit'}
          </FlashyText>
          {tokenUsageText && (
            <FlashyText type="static" speed={400} colors={['cyan', 'white']}>
              {tokenUsageText}
            </FlashyText>
          )}
          {!isSmallScreen && messagesLength === 0 && (
            <FlashyText type="static" speed={300} colors={['cyan', 'magenta', 'yellow']}>
              Commands: /verbose (toggle), /clear (clear), /compress (summarize), /themes (switch),
              /mode (toggle) | Tab to toggle mode | ↑↓ for history
            </FlashyText>
          )}
        </>
      )}
    </Box>
  );
}
