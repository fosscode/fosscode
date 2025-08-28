import { useState, useEffect, useMemo } from 'react';
import { Box, useStdout } from 'ink';
import Spinner from 'ink-spinner';
import { FlashyText } from './FlashyText.js';

interface LoadingIndicatorProps {
  messages?: string[];
}

const defaultMessages = [
  '🤔 Thinking deeply...',
  '🚀 Processing your request...',
  '💡 Generating brilliant ideas...',
  '⚡ Calculating the answer...',
  '🎯 Aiming for perfection...',
  '🔍 Searching for knowledge...',
  '🧠 Analyzing the problem...',
  '✨ Creating magic...',
  '🎨 Crafting the response...',
  '🌟 Illuminating the solution...',
  '🎪 Performing miracles...',
  '🌈 Creating rainbow magic...',
  '🔥 Igniting creativity...',
  '💫 Sparkling with genius...',
];

const compactMessages = [
  '🧠 Thinking...',
  '⚡ Processing...',
  '💡 Generating...',
  '🎯 Calculating...',
  '🔥 Working...',
  '🔍 Searching...',
  '🧠 Analyzing...',
  '✨ Creating...',
  '🎨 Crafting...',
  '🌟 Done...',
];

export function LoadingIndicator({ messages = defaultMessages }: LoadingIndicatorProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Get terminal dimensions for responsive design
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;

  // Use compact messages on small screens
  const displayMessages = terminalWidth < 50 ? compactMessages : messages;

  // Detect if running in tmux and adjust animation speed
  const isInTmux = useMemo(() => {
    return process.env.TMUX !== undefined;
  }, []);

  // Slower animation in tmux to reduce flickering and debounce
  const intervalDuration = isInTmux ? 2500 : 1200;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % displayMessages.length);
    }, intervalDuration);

    return () => clearInterval(interval);
  }, [displayMessages.length, intervalDuration]);

  return (
    <Box>
      <Spinner type="dots" />
      <FlashyText type="neon" speed={100}>
        {displayMessages[currentIndex]}
      </FlashyText>
    </Box>
  );
}
