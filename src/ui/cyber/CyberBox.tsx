/**
 * CYBERBOX - Stunning terminal box with glowing borders
 * Part of the FOSSCODE Cyberpunk UI Framework
 */

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { CyberBorders, CyberThemes, type BorderStyle, type CyberThemeColors } from './CyberTheme.js';

interface CyberBoxProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  width?: number | string;
  height?: number;
  borderStyle?: BorderStyle;
  theme?: CyberThemeColors;
  themeName?: string;
  glow?: boolean;
  scanlines?: boolean;
  padding?: number;
  marginTop?: number;
  marginBottom?: number;
  variant?: 'default' | 'header' | 'code' | 'error' | 'success' | 'warning' | 'info';
  cornerAccents?: boolean;
  headerDivider?: boolean;
}

export function CyberBox({
  children,
  title,
  subtitle,
  width,
  height,
  borderStyle = 'double',
  theme,
  themeName = 'neon',
  glow = true,
  scanlines = false,
  padding = 1,
  marginTop = 0,
  marginBottom = 0,
  variant = 'default',
  cornerAccents = true,
  headerDivider = true,
}: CyberBoxProps) {
  const colors = theme || CyberThemes[themeName] || CyberThemes.neon;
  const border = CyberBorders[borderStyle];

  // Determine border color based on variant
  const borderColor = useMemo(() => {
    switch (variant) {
      case 'error':
        return colors.error;
      case 'success':
        return colors.success;
      case 'warning':
        return colors.warning;
      case 'info':
        return colors.info;
      case 'header':
        return colors.headerGlow;
      case 'code':
        return colors.codeBlock;
      default:
        return glow ? colors.borderGlow : colors.border;
    }
  }, [variant, colors, glow]);

  // Corner accent characters for extra cyber effect
  const cornerAccentChars = useMemo(() => {
    if (!cornerAccents) return null;
    return {
      topLeft: '◤',
      topRight: '◥',
      bottomLeft: '◣',
      bottomRight: '◢',
    };
  }, [cornerAccents]);

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      marginTop={marginTop}
      marginBottom={marginBottom}
    >
      {/* Top border with optional corner accents */}
      <Box>
        {cornerAccents && cornerAccentChars && (
          <Text color={colors.accent}>{cornerAccentChars.topLeft}</Text>
        )}
        <Text color={borderColor}>
          {border.topLeft}
          {border.horizontal}
        </Text>
        {title && (
          <Text color={colors.muted}>{' ['}</Text>
        )}
        {title && (
          <Text color={colors.primary} bold>
            {title}
          </Text>
        )}
        {title && (
          <Text color={colors.muted}>{'] '}</Text>
        )}
        <Box flexGrow={1}>
          <Text color={borderColor}>{border.horizontal}</Text>
        </Box>
        <Text color={borderColor}>
          {border.horizontal}
          {border.topRight}
        </Text>
        {cornerAccents && cornerAccentChars && (
          <Text color={colors.accent}>{cornerAccentChars.topRight}</Text>
        )}
      </Box>

      {/* Subtitle line if provided */}
      {subtitle && (
        <Box>
          <Text color={borderColor}>{border.vertical}</Text>
          <Box paddingX={1} flexGrow={1}>
            <Text color={colors.muted}>{'// '}</Text>
            <Text color={colors.textDim}>{subtitle}</Text>
          </Box>
          <Text color={borderColor}>{border.vertical}</Text>
        </Box>
      )}

      {/* Divider after title/subtitle */}
      {(title || subtitle) && headerDivider && (
        <Box>
          <Text color={borderColor}>
            {border.teeLeft}
          </Text>
          <Box flexGrow={1}>
            <Text color={colors.muted}>
              {border.horizontal.repeat(80)}
            </Text>
          </Box>
          <Text color={borderColor}>
            {border.teeRight}
          </Text>
        </Box>
      )}

      {/* Content area */}
      <Box>
        <Text color={borderColor}>{border.vertical}</Text>
        <Box
          flexDirection="column"
          flexGrow={1}
          paddingX={padding}
          paddingY={padding > 0 ? Math.max(0, padding - 1) : 0}
        >
          {scanlines ? (
            <ScanlinesWrapper>{children}</ScanlinesWrapper>
          ) : (
            children
          )}
        </Box>
        <Text color={borderColor}>{border.vertical}</Text>
      </Box>

      {/* Bottom border with optional corner accents */}
      <Box>
        {cornerAccents && cornerAccentChars && (
          <Text color={colors.accent}>{cornerAccentChars.bottomLeft}</Text>
        )}
        <Text color={borderColor}>
          {border.bottomLeft}
        </Text>
        <Box flexGrow={1}>
          <Text color={borderColor}>{border.horizontal}</Text>
        </Box>
        <Text color={borderColor}>
          {border.bottomRight}
        </Text>
        {cornerAccents && cornerAccentChars && (
          <Text color={colors.accent}>{cornerAccentChars.bottomRight}</Text>
        )}
      </Box>
    </Box>
  );
}

// Scanlines wrapper component for that CRT effect
function ScanlinesWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Box flexDirection="column">
      {React.Children.map(children, (child, index) => (
        <Text dimColor={index % 2 === 1}>{child}</Text>
      ))}
    </Box>
  );
}

/**
 * Simple cyber-styled horizontal divider
 */
export function CyberDivider({
  style = 'double',
  color = 'cyan',
  width = 80,
  accent = true,
}: {
  style?: BorderStyle;
  color?: string;
  width?: number;
  accent?: boolean;
}) {
  const border = CyberBorders[style];

  return (
    <Box>
      {accent && <Text color={color}>{'◈'}</Text>}
      <Text color={color}>{border.horizontal.repeat(width - (accent ? 2 : 0))}</Text>
      {accent && <Text color={color}>{'◈'}</Text>}
    </Box>
  );
}

/**
 * Compact info badge component
 */
export function CyberBadge({
  label,
  value,
  color = 'cyan',
  bold = false,
}: {
  label: string;
  value: string;
  color?: string;
  bold?: boolean;
}) {
  return (
    <Box>
      <Text color="gray">{'['}</Text>
      <Text color={color} bold={bold}>
        {label}
      </Text>
      <Text color="gray">{':'}</Text>
      <Text color="white">{value}</Text>
      <Text color="gray">{']'}</Text>
    </Box>
  );
}

/**
 * Status indicator with dot
 */
export function CyberStatus({
  status,
  label,
  showLabel = true,
}: {
  status: 'online' | 'offline' | 'loading' | 'error' | 'warning' | 'success';
  label?: string;
  showLabel?: boolean;
}) {
  const config = {
    online: { char: '●', color: 'greenBright', text: 'ONLINE' },
    offline: { char: '○', color: 'gray', text: 'OFFLINE' },
    loading: { char: '◐', color: 'cyan', text: 'LOADING' },
    error: { char: '●', color: 'redBright', text: 'ERROR' },
    warning: { char: '●', color: 'yellow', text: 'WARNING' },
    success: { char: '●', color: 'greenBright', text: 'SUCCESS' },
  };

  const { char, color, text } = config[status];

  return (
    <Box>
      <Text color={color}>{char} </Text>
      {showLabel && <Text color={color}>{label || text}</Text>}
    </Box>
  );
}
