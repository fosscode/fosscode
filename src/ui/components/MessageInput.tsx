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
  const hasInput = input.length > 0;

  return (
    <Box alignItems="flex-start">
      <FlashyText type={hasInput ? 'static' : 'rainbow'} speed={500}>
        {isVerySmallScreen ? '$ ' : '> '}
      </FlashyText>
      <Text>
        {input ? (
          <>
            {input}
            <FlashyText type="static" speed={500} colors={['white']}>
              |
            </FlashyText>
          </>
        ) : (
          <FlashyText type="rainbow" speed={250}>
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
