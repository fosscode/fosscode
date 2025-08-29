import { Box } from 'ink';
import { FlashyText } from '../FlashyText.js';
import { AttachedFile } from '../hooks/useFileSearch.js';

interface AttachedFilesIndicatorProps {
  attachedFiles: AttachedFile[];
  isFileSearchMode: boolean;
}

export function AttachedFilesIndicator({
  attachedFiles,
  isFileSearchMode,
}: AttachedFilesIndicatorProps) {
  if (attachedFiles.length === 0 || isFileSearchMode) {
    return null;
  }

  return (
    <Box marginBottom={1}>
      <FlashyText type="static" speed={350} colors={['cyan', 'green', 'yellow']}>
        {`📎 Attached: ${attachedFiles.map(f => f.path).join(', ')}`}
      </FlashyText>
    </Box>
  );
}
