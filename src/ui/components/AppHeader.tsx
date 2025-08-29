import { Box } from 'ink';
import { FlashyText } from '../FlashyText.js';
import { ProviderType } from '../../types/index.js';

interface AppHeaderProps {
  provider: ProviderType;
  model: string;
  currentMode: 'code' | 'thinking';
  isSmallScreen: boolean;
  isVerySmallScreen: boolean;
}

export function AppHeader({
  provider,
  model,
  currentMode,
  isSmallScreen,
  isVerySmallScreen,
}: AppHeaderProps) {
  const modeIndicator = currentMode === 'thinking' ? '[THINKING]' : '[CODE]';

  let headerText: string;
  if (isVerySmallScreen) {
    headerText = `🚀 ${provider} ${modeIndicator}`;
  } else if (isSmallScreen) {
    headerText = `🚀 fosscode - ${provider} ${modeIndicator}`;
  } else {
    headerText = `🚀 fosscode - ${provider} (${model}) ${modeIndicator}`;
  }

  return (
    <Box marginBottom={isVerySmallScreen ? 0 : 1}>
      <FlashyText type="rainbow" speed={300}>
        {headerText}
      </FlashyText>
    </Box>
  );
}
