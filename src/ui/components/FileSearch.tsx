import { Box, Text } from 'ink';
import { FlashyText } from '../FlashyText.js';
import { FileSearchResult } from '../hooks/useFileSearch.js';

interface FileSearchProps {
  isVisible: boolean;
  query: string;
  results: FileSearchResult[];
  selectedIndex: number;
  isSearching: boolean;
  themeColors: {
    userMessage: string;
  };
}

export function FileSearch({
  isVisible,
  query,
  results,
  selectedIndex,
  isSearching,
  themeColors,
}: FileSearchProps) {
  if (!isVisible) return null;

  const renderedResults = results.slice(0, 5).map((file, index) => (
    <Text key={index} color={index === selectedIndex ? themeColors.userMessage : 'gray'}>
      {index === selectedIndex ? '▶ ' : '  '}
      {file.name} ({file.type})
    </Text>
  ));

  return (
    <Box flexDirection="column" marginBottom={1} paddingX={1}>
      <FlashyText type="static" speed={150}>
        {`🔍 Search files: ${query || '<type to search>'}${isSearching ? ' ⏳' : ''}`}
      </FlashyText>
      {isSearching ? (
        <FlashyText type="static" speed={200} colors={['yellow', 'cyan']}>
          🔎 Searching...
        </FlashyText>
      ) : results.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          {renderedResults}
          {results.length > 5 && (
            <FlashyText type="static" speed={300} colors={['gray', 'white']}>
              {`... and ${results.length - 5} more`}
            </FlashyText>
          )}
        </Box>
      ) : query ? (
        <FlashyText type="static" speed={250} colors={['red', 'orange']}>
          {`No files found matching "${query}"`}
        </FlashyText>
      ) : (
        <FlashyText type="static" speed={180}>
          Start typing to search files...
        </FlashyText>
      )}
      <FlashyText type="static" speed={220}>
        ↑↓ navigate • Enter select • Esc cancel
      </FlashyText>
    </Box>
  );
}
