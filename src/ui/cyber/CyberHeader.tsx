/**
 * CYBERHEADER - Stunning ASCII art header with animations
 * Part of the FOSSCODE Cyberpunk UI Framework
 */

import { useState, useEffect, useMemo } from 'react';
import { Box, Text, useStdout } from 'ink';
import { CyberText } from './CyberText.js';
import { CyberThemes, type CyberThemeColors } from './CyberTheme.js';

// ═══════════════════════════════════════════════════════════════════════════════
// ASCII ART LOGOS
// ═══════════════════════════════════════════════════════════════════════════════

const LOGOS = {
  // Compact single-line logo
  compact: `◈ FOSSCODE ◈`,

  // Small 2-line logo
  small: [
    '╔═══════════════════════╗',
    '║   ◈ FOSSCODE ◈   ║',
    '╚═══════════════════════╝',
  ],

  // Medium tech-style logo
  medium: [
    '┌──────────────────────────────────────┐',
    '│  ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄  │',
    '│  █  ███████╗ ██████╗ ███████╗███████╗   █  │',
    '│  █  ██╔════╝██╔═══██╗██╔════╝██╔════╝   █  │',
    '│  █  █████╗  ██║   ██║███████╗███████╗   █  │',
    '│  █  ██╔══╝  ██║   ██║╚════██║╚════██║   █  │',
    '│  █  ██║     ╚██████╔╝███████║███████║   █  │',
    '│  █  ╚═╝      ╚═════╝ ╚══════╝╚══════╝   █  │',
    '│  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀  │',
    '└──────────────────────────────────────┘',
  ],

  // Sleek cyber logo
  cyber: [
    '╭─────────────────────────────────────────╮',
    '│                                         │',
    '│  ███████╗ ██████╗ ███████╗███████╗      │',
    '│  ██╔════╝██╔═══██╗██╔════╝██╔════╝      │',
    '│  █████╗  ██║   ██║███████╗███████╗      │',
    '│  ██╔══╝  ██║   ██║╚════██║╚════██║      │',
    '│  ██║     ╚██████╔╝███████║███████║      │',
    '│  ╚═╝      ╚═════╝ ╚══════╝╚══════╝      │',
    '│                                         │',
    '│    ◈ FREE OPEN-SOURCE SOFTWARE CODE ◈   │',
    '│                                         │',
    '╰─────────────────────────────────────────╯',
  ],

  // Epic large logo
  large: [
    '╔══════════════════════════════════════════════════════════════════════════════╗',
    '║                                                                              ║',
    '║   ███████╗ ██████╗ ███████╗███████╗ ██████╗ ██████╗ ██████╗ ███████╗         ║',
    '║   ██╔════╝██╔═══██╗██╔════╝██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝         ║',
    '║   █████╗  ██║   ██║███████╗███████╗██║     ██║   ██║██║  ██║█████╗           ║',
    '║   ██╔══╝  ██║   ██║╚════██║╚════██║██║     ██║   ██║██║  ██║██╔══╝           ║',
    '║   ██║     ╚██████╔╝███████║███████║╚██████╗╚██████╔╝██████╔╝███████╗         ║',
    '║   ╚═╝      ╚═════╝ ╚══════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝         ║',
    '║                                                                              ║',
    '║   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ║',
    '║                    ◈ FREE OPEN-SOURCE SOFTWARE CODE ◈                        ║',
    '║                         AI-Powered Code Assistant                            ║',
    '║   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ║',
    '║                                                                              ║',
    '╚══════════════════════════════════════════════════════════════════════════════╝',
  ],

  // Minimal stylish logo
  minimal: [
    '┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓',
    '┃   ◈ F O S S C O D E ◈               ┃',
    '┃   ─────────────────────             ┃',
    '┃   Free Open-Source Software Code    ┃',
    '┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛',
  ],

  // Neon glow style
  neon: [
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
    '▓                                                ▓',
    '▓   ╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮    ▓',
    '▓   ┃  ▀█▀ █▀█ █▀ █▀ █▀▀ █▀█ █▀▄ █▀▀       ┃    ▓',
    '▓   ┃  █▄█ █▄█ ▄█ ▄█ █▄▄ █▄█ █▄▀ ██▄       ┃    ▓',
    '▓   ╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯    ▓',
    '▓                                                ▓',
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
  ],
};

type LogoSize = 'compact' | 'small' | 'medium' | 'cyber' | 'large' | 'minimal' | 'neon';

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERHEADER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberHeaderProps {
  provider: string;
  model: string;
  mode: 'code' | 'thinking';
  theme?: CyberThemeColors;
  themeName?: string;
  logoSize?: LogoSize | 'auto';
  animated?: boolean;
  showLogo?: boolean;
  compact?: boolean;
}

export function CyberHeader({
  provider,
  model,
  mode,
  theme,
  themeName = 'neon',
  logoSize = 'auto',
  animated = true,
  showLogo = true,
  compact = false,
}: CyberHeaderProps) {
  const colors = theme || CyberThemes[themeName] || CyberThemes.neon;
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;
  const [pulseFrame, setPulseFrame] = useState(0);

  // Pulse animation for status indicators
  useEffect(() => {
    if (!animated) return;

    const interval = setInterval(() => {
      setPulseFrame((prev) => (prev + 1) % 4);
    }, 400);

    return () => clearInterval(interval);
  }, [animated]);

  // Auto-select logo size based on terminal width
  const selectedLogoSize = useMemo((): LogoSize => {
    if (logoSize !== 'auto') return logoSize;

    if (terminalWidth < 50) return 'compact';
    if (terminalWidth < 70) return 'small';
    if (terminalWidth < 90) return 'minimal';
    if (terminalWidth < 110) return 'cyber';
    return 'large';
  }, [logoSize, terminalWidth]);

  // Get the logo lines
  const logoLines = useMemo(() => {
    const logo = LOGOS[selectedLogoSize];
    if (typeof logo === 'string') return [logo];
    return logo;
  }, [selectedLogoSize]);

  // Pulse colors for mode indicator
  const pulseColors = [colors.primary, colors.secondary, colors.primary, colors.accent];
  const currentPulseColor = pulseColors[pulseFrame];

  // Mode indicator styling
  const modeConfig = {
    code: { icon: '⚡', label: 'CODE', color: colors.success },
    thinking: { icon: '🧠', label: 'THINK', color: colors.warning },
  };

  const currentMode = modeConfig[mode];

  if (compact) {
    // Compact single-line header
    return (
      <Box marginBottom={1}>
        <Box>
          <Text color={colors.accent}>{'◈ '}</Text>
          <Text color={colors.primary} bold>
            FOSSCODE
          </Text>
          <Text color={colors.muted}>{' │ '}</Text>
          <Text color={colors.secondary}>{provider}</Text>
          <Text color={colors.muted}>{':'}</Text>
          <Text color={colors.textDim}>{model}</Text>
          <Text color={colors.muted}>{' │ '}</Text>
          <Text color={currentMode.color}>
            {currentMode.icon} {currentMode.label}
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* ASCII Art Logo */}
      {showLogo && (
        <Box flexDirection="column">
          {logoLines.map((line, index) => (
            <CyberText
              key={index}
              effect={animated && index === Math.floor(logoLines.length / 2) ? 'pulse' : 'static'}
              color={colors.primary}
              colors={[colors.primary, colors.secondary, colors.accent]}
              speed={300}
            >
              {line}
            </CyberText>
          ))}
        </Box>
      )}

      {/* Status Bar */}
      <Box marginTop={showLogo ? 1 : 0}>
        {/* Left section: Provider info */}
        <Box>
          <Text color={colors.muted}>{'['}</Text>
          <Text color={animated ? currentPulseColor : colors.success}>●</Text>
          <Text color={colors.muted}>{'] '}</Text>
          <Text color={colors.secondary} bold>
            {provider.toUpperCase()}
          </Text>
          <Text color={colors.muted}>{' :: '}</Text>
          <Text color={colors.textDim}>{model}</Text>
        </Box>

        {/* Separator */}
        <Box flexGrow={1} justifyContent="center">
          <Text color={colors.muted}>
            {' ─────────── '}
          </Text>
        </Box>

        {/* Right section: Mode indicator */}
        <Box>
          <Text color={colors.muted}>{'[ '}</Text>
          <Text color={currentMode.color}>
            {currentMode.icon}
          </Text>
          <Text color={currentMode.color} bold>
            {' '}{currentMode.label}
          </Text>
          <Text color={colors.muted}>{' ]'}</Text>
        </Box>
      </Box>

      {/* Decorative line */}
      <Box>
        <Text color={colors.border}>
          {'━'.repeat(Math.min(terminalWidth - 2, 80))}
        </Text>
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERLOGO - Standalone animated logo
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberLogoProps {
  size?: LogoSize;
  animated?: boolean;
  theme?: CyberThemeColors;
  themeName?: string;
}

export function CyberLogo({
  size = 'medium',
  animated = true,
  theme,
  themeName = 'neon',
}: CyberLogoProps) {
  const colors = theme || CyberThemes[themeName] || CyberThemes.neon;

  const logoLines = useMemo(() => {
    const logo = LOGOS[size];
    if (typeof logo === 'string') return [logo];
    return logo;
  }, [size]);

  return (
    <Box flexDirection="column">
      {logoLines.map((line, index) => (
        <CyberText
          key={index}
          effect={animated ? 'wave' : 'static'}
          color={colors.primary}
          colors={[colors.primary, colors.secondary, colors.accent, colors.highlight]}
          speed={200}
        >
          {line}
        </CyberText>
      ))}
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERBANNER - Animated welcome/status banner
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberBannerProps {
  title: string;
  subtitle?: string;
  variant?: 'welcome' | 'info' | 'success' | 'warning' | 'error';
  animated?: boolean;
  theme?: CyberThemeColors;
  themeName?: string;
}

export function CyberBanner({
  title,
  subtitle,
  variant = 'info',
  animated = true,
  theme,
  themeName = 'neon',
}: CyberBannerProps) {
  const colors = theme || CyberThemes[themeName] || CyberThemes.neon;

  const variantColors = {
    welcome: colors.primary,
    info: colors.info,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
  };

  const variantIcons = {
    welcome: '◈',
    info: 'ℹ',
    success: '✓',
    warning: '⚠',
    error: '✗',
  };

  const bannerColor = variantColors[variant];
  const icon = variantIcons[variant];

  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color={bannerColor}>{'╭─'}</Text>
        <Text color={bannerColor}>{icon}</Text>
        <Text color={bannerColor}>{'─'}</Text>
        <CyberText
          effect={animated ? 'pulse' : 'static'}
          color={bannerColor}
          bold
        >
          {` ${title.toUpperCase()} `}
        </CyberText>
        <Text color={bannerColor}>{'─'.repeat(20)}</Text>
        <Text color={bannerColor}>{'╮'}</Text>
      </Box>

      {subtitle && (
        <Box>
          <Text color={bannerColor}>{'│  '}</Text>
          <Text color={colors.textDim}>{subtitle}</Text>
        </Box>
      )}

      <Box>
        <Text color={bannerColor}>{'╰'}</Text>
        <Text color={bannerColor}>{'─'.repeat(40)}</Text>
        <Text color={bannerColor}>{'╯'}</Text>
      </Box>
    </Box>
  );
}
