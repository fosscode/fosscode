import { useState, useEffect, useMemo } from 'react';
import { Box } from 'ink';
import Spinner from 'ink-spinner';
import { FlashyText } from './FlashyText.js';
import { isInTmux } from '../utils/tmuxUtils.js';

interface InteractiveLoadingProps {
  frames?: string[][];
}

const defaultFrames = [
  ['🤔', '💭'],
  ['🤔', '💭', '💡'],
  ['🤔', '💭', '💡', '✨'],
  ['🤔', '💭', '💡', '✨', '🚀'],
  ['🤔', '💭', '💡', '✨', '🚀', '⚡'],
  ['🤔', '💭', '💡', '✨', '🚀', '⚡', '🎯'],
  ['🤔', '💭', '💡', '✨', '🚀', '⚡', '🎯', '🔍'],
  ['🤔', '💭', '💡', '✨', '🚀', '⚡', '🎯', '🔍', '🧠'],
  ['🤔', '💭', '💡', '✨', '🚀', '⚡', '🎯', '🔍', '🧠', '🎨'],
  ['🤔', '💭', '💡', '✨', '🚀', '⚡', '🎯', '🔍', '🧠', '🎨', '🌟'],
  ['🤔', '💭', '💡', '✨', '🚀', '⚡', '🎯', '🔍', '🧠', '🎨', '🌟', '🎪'],
  ['🤔', '💭', '💡', '✨', '🚀', '⚡', '🎯', '🔍', '🧠', '🎨', '🌟', '🎪', '🎨'],
  ['🤔', '💭', '💡', '✨', '🚀', '⚡', '🎯', '🔍', '🧠', '🎨', '🌟', '🎪', '🎨', '🌈'],
];

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

export function InteractiveLoading({ frames = defaultFrames }: InteractiveLoadingProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [currentMessage, setCurrentMessage] = useState(0);

  // Detect if running in tmux and adjust animation speed
  const tmuxDetected = useMemo(() => {
    return isInTmux();
  }, []);

  // Slower animation in tmux to reduce flickering
  const frameInterval = tmuxDetected ? 1200 : 600;
  const messageInterval = tmuxDetected ? 1600 : 800;

  useEffect(() => {
    const frameTimer = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % frames.length);
    }, frameInterval);

    const messageTimer = setInterval(() => {
      setCurrentMessage(prev => (prev + 1) % messages.length);
    }, messageInterval);

    return () => {
      clearInterval(frameTimer);
      clearInterval(messageTimer);
    };
  }, [frames.length, frameInterval, messageInterval]);

  const currentEmojis = frames[currentFrame] || [];
  const message = messages[currentMessage];

  return (
    <Box flexDirection="column">
      <Box>
        <Spinner type="dots" />
        <FlashyText type="static" speed={150}>
          {message}
        </FlashyText>
      </Box>
      {/* Only show emoji animation if not in tmux to reduce flickering */}
      {!tmuxDetected && (
        <Box marginTop={1}>
          {currentEmojis.map((emoji, index) => (
            <Box key={index} marginRight={1}>
              <FlashyText type="static" speed={100}>
                {emoji}
              </FlashyText>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
