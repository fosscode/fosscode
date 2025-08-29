import { Box, Text } from 'ink';
import { FlashyText } from '../FlashyText.js';

interface MessageInputProps {
  input: string;
  currentMode: 'code' | 'thinking';
  isVerySmallScreen: boolean;
  isSmallScreen: boolean;
}

export function MessageInput({
  input,
  currentMode,
  isVerySmallScreen,
  isSmallScreen,
}: MessageInputProps) {
  return (
    <Box alignItems="flex-start">
      <FlashyText type="flash" speed={500} colors={['yellow', 'cyan']}>
        {isVerySmallScreen ? '$ ' : '> '}
      </FlashyText>
      <Text>
        {input || (
          <FlashyText type="wave" speed={250} colors={['gray', 'white']}>
            {isVerySmallScreen
              ? 'Msg...'
              : isSmallScreen
                ? `Type message... (${currentMode})`
                : `Type your message... (${currentMode}) (Ctrl+C to exit)`}
          </FlashyText>
        )}
      </Text>
    </Box>
  );
}
