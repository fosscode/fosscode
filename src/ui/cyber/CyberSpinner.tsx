/**
 * CYBERSPINNER - Advanced loading animations
 * Part of the FOSSCODE Cyberpunk UI Framework
 */

import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { CyberText } from './CyberText.js';
import {
  CyberSpinners,
  CyberThemes,
  type SpinnerStyle,
  type CyberThemeColors,
} from './CyberTheme.js';

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING MESSAGES - Cyberpunk themed
// ═══════════════════════════════════════════════════════════════════════════════

const LOADING_MESSAGES = {
  default: [
    'Initializing neural interface...',
    'Connecting to data streams...',
    'Processing quantum calculations...',
    'Synthesizing response matrix...',
    'Engaging cognitive protocols...',
    'Analyzing input patterns...',
    'Generating code sequences...',
    'Compiling thought processes...',
    'Optimizing output streams...',
    'Finalizing neural pathways...',
  ],

  hacking: [
    'Bypassing firewall...',
    'Decrypting data blocks...',
    'Injecting payload...',
    'Accessing mainframe...',
    'Extracting intelligence...',
    'Routing through proxies...',
    'Masking digital signature...',
    'Cracking encryption...',
  ],

  ai: [
    'Training neural networks...',
    'Adjusting weights and biases...',
    'Running inference engine...',
    'Optimizing token predictions...',
    'Processing embeddings...',
    'Calculating attention scores...',
    'Generating response vectors...',
    'Applying transformer layers...',
  ],

  coding: [
    'Parsing syntax trees...',
    'Analyzing code patterns...',
    'Refactoring algorithms...',
    'Debugging logic flows...',
    'Optimizing performance...',
    'Generating clean code...',
    'Building solutions...',
    'Compiling thoughts...',
  ],

  minimal: [
    'Processing...',
    'Computing...',
    'Loading...',
    'Working...',
    'Thinking...',
  ],
};

type MessageTheme = keyof typeof LOADING_MESSAGES;

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERSPINNER - Main spinner component
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberSpinnerProps {
  style?: SpinnerStyle;
  message?: string;
  messageTheme?: MessageTheme;
  showMessage?: boolean;
  animated?: boolean;
  speed?: number;
  color?: string;
  colors?: string[];
  theme?: CyberThemeColors;
  themeName?: string;
  size?: 'small' | 'medium' | 'large';
}

export function CyberSpinner({
  style = 'cyberDots',
  message,
  messageTheme = 'default',
  showMessage = true,
  animated = true,
  speed = 100,
  color,
  colors,
  theme,
  themeName = 'neon',
  size = 'medium',
}: CyberSpinnerProps) {
  const themeColors = theme || CyberThemes[themeName] || CyberThemes.neon;
  const [frame, setFrame] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  const spinnerFrames = CyberSpinners[style] || CyberSpinners.cyberDots;
  const messages = LOADING_MESSAGES[messageTheme];
  const spinnerColor = color || themeColors.primary;
  const colorPalette = colors || [themeColors.primary, themeColors.secondary, themeColors.accent];

  // Spinner animation
  useEffect(() => {
    if (!animated) return;

    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % spinnerFrames.length);
    }, speed);

    return () => clearInterval(interval);
  }, [animated, speed, spinnerFrames.length]);

  // Message rotation
  useEffect(() => {
    if (!showMessage || !animated) return;

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [showMessage, animated, messages.length]);

  const currentFrame = spinnerFrames[frame];
  const currentMessage = message || messages[messageIndex];
  const currentColor = colorPalette[frame % colorPalette.length];

  // Size configurations
  const sizeConfig = {
    small: { padding: 0, showExtras: false },
    medium: { padding: 1, showExtras: true },
    large: { padding: 2, showExtras: true },
  };

  const config = sizeConfig[size];

  return (
    <Box flexDirection="column" paddingY={config.padding}>
      <Box>
        {/* Spinner */}
        <Text color={currentColor} bold>
          {currentFrame}
        </Text>
        <Text> </Text>

        {/* Message */}
        {showMessage && (
          <CyberText
            effect={animated ? 'pulse' : 'static'}
            color={spinnerColor}
            colors={colorPalette}
            speed={200}
          >
            {currentMessage}
          </CyberText>
        )}
      </Box>

      {/* Progress bar for large size */}
      {size === 'large' && config.showExtras && (
        <Box marginTop={1}>
          <CyberProgressBar
            animated
            color={spinnerColor}
            width={40}
            theme={themeColors}
          />
        </Box>
      )}
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERPROGRESSBAR - Animated progress bar
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberProgressBarProps {
  progress?: number; // 0-100, or undefined for indeterminate
  animated?: boolean;
  width?: number;
  color?: string;
  theme?: CyberThemeColors;
  style?: 'electric' | 'neon' | 'blocks' | 'minimal' | 'pulse';
}

export function CyberProgressBar({
  progress,
  animated = true,
  width = 30,
  color = 'cyan',
  theme,
  style = 'electric',
}: CyberProgressBarProps) {
  const [animationOffset, setAnimationOffset] = useState(0);
  const colors = theme || CyberThemes.neon;

  // Animation for indeterminate progress
  useEffect(() => {
    if (progress !== undefined || !animated) return;

    const interval = setInterval(() => {
      setAnimationOffset((prev) => (prev + 1) % width);
    }, 80);

    return () => clearInterval(interval);
  }, [progress, animated, width]);

  const styleConfig = {
    electric: { filled: '█', empty: '░', head: '▓', left: '[', right: ']' },
    neon: { filled: '━', empty: '─', head: '●', left: '╺', right: '╸' },
    blocks: { filled: '▓', empty: '░', head: '█', left: '▐', right: '▌' },
    minimal: { filled: '●', empty: '○', head: '◉', left: '', right: '' },
    pulse: { filled: '▰', empty: '▱', head: '▰', left: '⟨', right: '⟩' },
  };

  const chars = styleConfig[style];

  // Build the progress bar
  const buildBar = () => {
    const innerWidth = width - chars.left.length - chars.right.length;

    if (progress !== undefined) {
      // Determinate progress
      const filledCount = Math.floor((progress / 100) * innerWidth);
      const emptyCount = innerWidth - filledCount;

      return (
        chars.left +
        chars.filled.repeat(Math.max(0, filledCount - 1)) +
        (filledCount > 0 ? chars.head : '') +
        chars.empty.repeat(emptyCount) +
        chars.right
      );
    } else {
      // Indeterminate animation (scanning effect)
      const scanWidth = 5;
      let bar = '';

      for (let i = 0; i < innerWidth; i++) {
        const distFromScan = Math.abs(i - animationOffset);
        if (distFromScan < scanWidth) {
          bar += distFromScan === 0 ? chars.head : chars.filled;
        } else {
          bar += chars.empty;
        }
      }

      return chars.left + bar + chars.right;
    }
  };

  return (
    <Box>
      <Text color={color}>{buildBar()}</Text>
      {progress !== undefined && (
        <Text color={colors.textDim}>{` ${Math.round(progress)}%`}</Text>
      )}
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERLOADINGSCREEN - Full loading screen with animation
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberLoadingScreenProps {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  theme?: CyberThemeColors;
  themeName?: string;
}

export function CyberLoadingScreen({
  title = 'INITIALIZING',
  subtitle,
  showLogo = true,
  theme,
  themeName = 'neon',
}: CyberLoadingScreenProps) {
  const colors = theme || CyberThemes[themeName] || CyberThemes.neon;
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return (
    <Box flexDirection="column" alignItems="center" padding={2}>
      {showLogo && (
        <Box marginBottom={1}>
          <CyberText effect="wave" color={colors.primary}>
            {'◈ FOSSCODE ◈'}
          </CyberText>
        </Box>
      )}

      <Box marginBottom={1}>
        <Text color={colors.accent} bold>
          {'[ '}
        </Text>
        <CyberText effect="pulse" color={colors.primary}>
          {title}
        </CyberText>
        <Text color={colors.primary}>{dots}</Text>
        <Text color={colors.accent} bold>
          {' ]'}
        </Text>
      </Box>

      <CyberSpinner
        style="cyberDots"
        messageTheme="ai"
        theme={colors}
        size="medium"
      />

      {subtitle && (
        <Box marginTop={1}>
          <Text color={colors.textDim}>{subtitle}</Text>
        </Box>
      )}
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERTYPINGDOTS - Simple typing indicator
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberTypingDotsProps {
  color?: string;
  speed?: number;
}

export function CyberTypingDots({
  color = 'cyan',
  speed = 300,
}: CyberTypingDotsProps) {
  const [frame, setFrame] = useState(0);
  const frames = ['●○○', '○●○', '○○●', '○●○'];

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % frames.length);
    }, speed);

    return () => clearInterval(interval);
  }, [speed, frames.length]);

  return <Text color={color}>{frames[frame]}</Text>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERPULSE - Pulsing status indicator
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberPulseProps {
  color?: string;
  secondaryColor?: string;
  speed?: number;
  label?: string;
}

export function CyberPulse({
  color = 'cyanBright',
  secondaryColor = 'cyan',
  speed = 500,
  label,
}: CyberPulseProps) {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setActive((prev) => !prev);
    }, speed);

    return () => clearInterval(interval);
  }, [speed]);

  return (
    <Box>
      <Text color={active ? color : secondaryColor} bold={active}>
        ●
      </Text>
      {label && (
        <Text color={active ? color : secondaryColor}>{' '}{label}</Text>
      )}
    </Box>
  );
}
