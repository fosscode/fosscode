import { useState, useEffect, useMemo } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

const messages = [
  '🧠 Thinking deeply...',
  '⚡ Processing with lightning speed...',
  '💡 Generating brilliant ideas...',
  '✨ Creating magical solutions...',
  '🚀 Launching rockets of innovation...',
  '🔥 Powering up the engines...',
  '🎯 Targeting goals with precision...',
  '🔍 Searching the depths of knowledge...',
  '🧠 Brainstorming genius concepts...',
  '🎨 Crafting artistic masterpieces...',
  '🌟 Shining bright with brilliance...',
  '🎪 Performing circus tricks...',
  '🎨 Painting with digital colors...',
  '🌈 Creating rainbow magic...',
];

export function InteractiveLoading() {
  const [currentMessage, setCurrentMessage] = useState(0);

  // Detect if running in tmux
  const isInTmux = useMemo(() => {
    return process.env.TMUX !== undefined;
  }, []);

  // Much slower message updates to reduce redraws and debounce
  const messageInterval = isInTmux ? 5000 : 3000;

  useEffect(() => {
    const messageTimer = setInterval(() => {
      setCurrentMessage(prev => (prev + 1) % messages.length);
    }, messageInterval);

    return () => {
      clearInterval(messageTimer);
    };
  }, [messageInterval]);

  const message = messages[currentMessage];

  return (
    <Box flexDirection="column">
      <Box>
        <Spinner type="dots" />
        <Text color="cyan">{message}</Text>
      </Box>
      {/* Static emoji display to reduce flickering */}
      {!isInTmux && (
        <Box marginTop={1}>
          <Text color="yellow">🤔 💭 💡 ✨ 🚀 ⚡ 🎯 🔍 🧠 🎨 🌟</Text>
        </Box>
      )}
    </Box>
  );
}
