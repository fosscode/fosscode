import { Box } from 'ink';
import { FlashyText } from '../FlashyText.js';

interface AppFooterProps {
  messagesLength: number;
  isVerySmallScreen: boolean;
  isSmallScreen: boolean;
}

export function AppFooter({ messagesLength, isVerySmallScreen, isSmallScreen }: AppFooterProps) {
  // Only show footer if there are messages or not on very small screen
  if (messagesLength === 0 && isVerySmallScreen) {
    return null;
  }

  return (
    <Box marginTop={isVerySmallScreen ? 2 : isSmallScreen ? 2 : 1}>
      {isVerySmallScreen ? (
        <FlashyText type="static" speed={400} colors={['gray', 'white']}>
          Enter send • Ctrl+C exit
        </FlashyText>
      ) : (
        <>
          <FlashyText type="static" speed={400} colors={['gray', 'white']}>
            {isSmallScreen
              ? 'Enter to send, Ctrl+C to exit'
              : 'Type your message and press Enter to send, Ctrl+C to exit'}
          </FlashyText>
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
