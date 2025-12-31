/**
 * CYBERFOOTER - Stunning footer with status and hints
 * Part of the FOSSCODE Cyberpunk UI Framework
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
import { CyberText } from './CyberText.js';
import { CyberThemes, CyberSymbols, type CyberThemeColors } from './CyberTheme.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERFOOTER - Main footer component
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberFooterProps {
  messagesCount?: number;
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  scrollPosition?: { current: number; total: number } | undefined;
  theme?: CyberThemeColors;
  themeName?: string;
  compact?: boolean;
  showHints?: boolean;
}

export function CyberFooter({
  messagesCount = 0,
  totalTokens = 0,
  promptTokens = 0,
  completionTokens = 0,
  scrollPosition,
  theme,
  themeName = 'neon',
  compact = false,
  showHints = true,
}: CyberFooterProps) {
  const colors = theme || CyberThemes[themeName] || CyberThemes.neon;
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;
  const [pulseFrame, setPulseFrame] = useState(0);

  // Pulse animation
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseFrame((prev) => (prev + 1) % 4);
    }, 300);
    return () => clearInterval(interval);
  }, []);

  // Format token count with K suffix for large numbers
  const formatTokens = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  // Pulse colors for activity indicator
  const pulseColors = [colors.success, colors.primary, colors.accent, colors.primary];
  const currentPulseColor = pulseColors[pulseFrame];

  if (compact) {
    return (
      <Box marginTop={1}>
        <Text color={colors.muted}>
          {CyberSymbols.lineThin.repeat(Math.min(terminalWidth - 2, 80))}
        </Text>
        <Box>
          <Text color={colors.textDim}>{'Msgs:'}</Text>
          <Text color={colors.info}>{messagesCount}</Text>
          <Text color={colors.muted}>{' │ '}</Text>
          <Text color={colors.textDim}>{'Tokens:'}</Text>
          <Text color={colors.accent}>{formatTokens(totalTokens)}</Text>
          <Text color={colors.muted}>{' │ '}</Text>
          <Text color={colors.textDim}>{'Enter'}</Text>
          <Text color={colors.muted}>{' send '}</Text>
          <Text color={colors.textDim}>{'Ctrl+C'}</Text>
          <Text color={colors.muted}>{' exit'}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Top border */}
      <Box>
        <Text color={colors.border}>
          {'━'.repeat(Math.min(terminalWidth - 2, 80))}
        </Text>
      </Box>

      {/* Main footer row */}
      <Box justifyContent="space-between">
        {/* Left section: Status indicators */}
        <Box>
          <Text color={currentPulseColor}>{CyberSymbols.online}</Text>
          <Text color={colors.muted}>{' FOSSCODE '}</Text>
          <Text color={colors.muted}>{'│ '}</Text>

          {/* Messages count */}
          <Text color={colors.textDim}>{'msgs:'}</Text>
          <Text color={colors.info}>{messagesCount}</Text>

          {/* Token usage */}
          {totalTokens > 0 && (
            <>
              <Text color={colors.muted}>{' │ '}</Text>
              <Text color={colors.textDim}>{CyberSymbols.data} </Text>
              <Text color={colors.accent}>{formatTokens(totalTokens)}</Text>
              <Text color={colors.muted}>{' ('}</Text>
              <Text color={colors.success}>{formatTokens(promptTokens)}</Text>
              <Text color={colors.muted}>{'/'}</Text>
              <Text color={colors.warning}>{formatTokens(completionTokens)}</Text>
              <Text color={colors.muted}>{')'}</Text>
            </>
          )}

          {/* Scroll position */}
          {scrollPosition && scrollPosition.total > 0 && (
            <>
              <Text color={colors.muted}>{' │ '}</Text>
              <Text color={colors.textDim}>{'scroll:'}</Text>
              <Text color={colors.info}>
                {scrollPosition.current}/{scrollPosition.total}
              </Text>
            </>
          )}
        </Box>

        {/* Right section: Keyboard hints */}
        {showHints && (
          <Box>
            <KeyboardHint keyName="Enter" action="send" colors={colors} />
            <Text color={colors.muted}>{' │ '}</Text>
            <KeyboardHint keyName="Tab" action="mode" colors={colors} />
            <Text color={colors.muted}>{' │ '}</Text>
            <KeyboardHint keyName="↑↓" action="history" colors={colors} />
            <Text color={colors.muted}>{' │ '}</Text>
            <KeyboardHint keyName="Ctrl+C" action="exit" colors={colors} />
          </Box>
        )}
      </Box>

      {/* Commands hint row */}
      {showHints && messagesCount === 0 && (
        <Box marginTop={1}>
          <Text color={colors.textDim}>{'Commands: '}</Text>
          <CommandHint cmd="/clear" colors={colors} />
          <Text color={colors.muted}>{' '}</Text>
          <CommandHint cmd="/themes" colors={colors} />
          <Text color={colors.muted}>{' '}</Text>
          <CommandHint cmd="/mode" colors={colors} />
          <Text color={colors.muted}>{' '}</Text>
          <CommandHint cmd="/verbose" colors={colors} />
          <Text color={colors.muted}>{' '}</Text>
          <CommandHint cmd="/help" colors={colors} />
        </Box>
      )}
    </Box>
  );
}

// Helper components
function KeyboardHint({
  keyName,
  action,
  colors,
}: {
  keyName: string;
  action: string;
  colors: CyberThemeColors;
}) {
  return (
    <>
      <Text color={colors.accent} bold>
        {keyName}
      </Text>
      <Text color={colors.textDim}>{' ' + action}</Text>
    </>
  );
}

function CommandHint({
  cmd,
  colors,
}: {
  cmd: string;
  colors: CyberThemeColors;
}) {
  return (
    <Text color={colors.warning}>{cmd}</Text>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERSTATUSBAR - Minimal status bar
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberStatusBarProps {
  items: Array<{ label: string; value: string; color?: string }>;
  theme?: CyberThemeColors;
  themeName?: string;
}

export function CyberStatusBar({
  items,
  theme,
  themeName = 'neon',
}: CyberStatusBarProps) {
  const colors = theme || CyberThemes[themeName] || CyberThemes.neon;

  return (
    <Box>
      {items.map((item, index) => (
        <React.Fragment key={item.label}>
          {index > 0 && <Text color={colors.muted}>{' │ '}</Text>}
          <Text color={colors.textDim}>{item.label}:</Text>
          <Text color={item.color || colors.text}>{item.value}</Text>
        </React.Fragment>
      ))}
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERTOKENBAR - Token usage visualization
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberTokenBarProps {
  prompt: number;
  completion: number;
  limit?: number;
  theme?: CyberThemeColors;
  themeName?: string;
}

export function CyberTokenBar({
  prompt,
  completion,
  limit = 128000,
  theme,
  themeName = 'neon',
}: CyberTokenBarProps) {
  const colors = theme || CyberThemes[themeName] || CyberThemes.neon;
  const total = prompt + completion;
  const percentage = Math.min((total / limit) * 100, 100);

  const barWidth = 30;
  const filledWidth = Math.floor((percentage / 100) * barWidth);
  const promptWidth = Math.floor((prompt / Math.max(total, 1)) * filledWidth);
  const completionWidth = filledWidth - promptWidth;

  // Color based on usage level
  const barColor = percentage > 80 ? colors.error :
                   percentage > 60 ? colors.warning :
                   colors.success;

  return (
    <Box>
      <Text color={colors.textDim}>{CyberSymbols.data} </Text>
      <Text color={colors.muted}>{'['}</Text>
      <Text color={colors.success}>{'█'.repeat(promptWidth)}</Text>
      <Text color={colors.warning}>{'█'.repeat(completionWidth)}</Text>
      <Text color={colors.muted}>{'░'.repeat(barWidth - filledWidth)}</Text>
      <Text color={colors.muted}>{']'}</Text>
      <Text color={barColor}>{` ${percentage.toFixed(0)}%`}</Text>
      <Text color={colors.textDim}>{` (${(total / 1000).toFixed(1)}K/${(limit / 1000).toFixed(0)}K)`}</Text>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERNOTIFICATION - Pop-up style notification
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberNotificationProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  icon?: string;
  theme?: CyberThemeColors;
  themeName?: string;
}

export function CyberNotification({
  message,
  type = 'info',
  icon,
  theme,
  themeName = 'neon',
}: CyberNotificationProps) {
  const colors = theme || CyberThemes[themeName] || CyberThemes.neon;

  const typeConfig = {
    info: { color: colors.info, icon: 'ℹ', border: '─' },
    success: { color: colors.success, icon: '✓', border: '─' },
    warning: { color: colors.warning, icon: '⚠', border: '─' },
    error: { color: colors.error, icon: '✗', border: '─' },
  };

  const config = typeConfig[type];
  const displayIcon = icon || config.icon;

  return (
    <Box>
      <Text color={config.color}>{'╭─'}</Text>
      <Text color={config.color}>{displayIcon}</Text>
      <Text color={config.color}>{'─╮ '}</Text>
      <CyberText effect="pulse" color={config.color}>
        {message}
      </CyberText>
    </Box>
  );
}
