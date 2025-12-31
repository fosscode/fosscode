/**
 * CYBERTEXT - Advanced text rendering with neon effects
 * Part of the FOSSCODE Cyberpunk UI Framework
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Text, Box } from 'ink';
import {
  CyberThemes,
  GlitchChars,
  type CyberThemeColors,
} from './CyberTheme.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERTEXT - Animated neon text with multiple effects
// ═══════════════════════════════════════════════════════════════════════════════

type EffectType =
  | 'static'
  | 'pulse'
  | 'rainbow'
  | 'wave'
  | 'glitch'
  | 'typewriter'
  | 'matrix'
  | 'neon'
  | 'gradient'
  | 'flicker';

interface CyberTextProps {
  children: string;
  effect?: EffectType;
  color?: string;
  colors?: string[];
  speed?: number;
  intensity?: number;
  bold?: boolean;
  dim?: boolean;
  underline?: boolean;
  theme?: CyberThemeColors;
  themeName?: string;
}

// Neon color cycling palette
const neonPalette = ['cyanBright', 'magentaBright', 'yellowBright', 'greenBright', 'blueBright'];

// Rainbow palette
const rainbowPalette = ['redBright', 'yellowBright', 'greenBright', 'cyanBright', 'blueBright', 'magentaBright'];

// Matrix green shades
const matrixPalette = ['green', 'greenBright', 'white', 'greenBright', 'green', 'gray'];

export function CyberText({
  children,
  effect = 'static',
  color,
  colors,
  speed = 150,
  intensity = 0.5,
  bold = false,
  dim = false,
  underline = false,
  theme,
  themeName = 'neon',
}: CyberTextProps) {
  const [frame, setFrame] = useState(0);
  const [glitchText, setGlitchText] = useState(children);
  const [typewriterIndex, setTypewriterIndex] = useState(0);
  const [flickerOn, setFlickerOn] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);

  const colors_ = theme || CyberThemes[themeName] || CyberThemes.neon;
  const baseColor = color || colors_.primary;

  const palette = useMemo(() => {
    if (colors) return colors;
    switch (effect) {
      case 'rainbow':
        return rainbowPalette;
      case 'matrix':
        return matrixPalette;
      case 'neon':
      case 'wave':
      case 'gradient':
        return neonPalette;
      default:
        return [baseColor];
    }
  }, [effect, colors, baseColor]);

  // Glitch text generator
  const generateGlitch = useCallback(() => {
    if (intensity === 0) return children;

    return children
      .split('')
      .map((char) => {
        if (char === ' ' || Math.random() > intensity * 0.4) return char;

        // Random substitution
        if (Math.random() < intensity * 0.15) {
          return GlitchChars.substitutes[
            Math.floor(Math.random() * GlitchChars.substitutes.length)
          ];
        }

        // Add zalgo-like decorators
        const topGlitch =
          Math.random() < intensity * 0.3
            ? GlitchChars.top[Math.floor(Math.random() * GlitchChars.top.length)]
            : '';
        const bottomGlitch =
          Math.random() < intensity * 0.3
            ? GlitchChars.bottom[Math.floor(Math.random() * GlitchChars.bottom.length)]
            : '';

        return char + topGlitch + bottomGlitch;
      })
      .join('');
  }, [children, intensity]);

  // Animation loop
  useEffect(() => {
    if (effect === 'static') return;

    const animate = () => {
      const now = Date.now();
      if (now - lastUpdateRef.current < 50) return;
      lastUpdateRef.current = now;

      switch (effect) {
        case 'pulse':
        case 'rainbow':
        case 'wave':
        case 'neon':
        case 'gradient':
          setFrame((prev) => (prev + 1) % palette.length);
          break;
        case 'glitch':
          setGlitchText(generateGlitch());
          break;
        case 'typewriter':
          setTypewriterIndex((prev) => (prev < children.length ? prev + 1 : prev));
          break;
        case 'matrix':
          setFrame((prev) => (prev + 1) % palette.length);
          if (Math.random() < 0.1) {
            setGlitchText(generateGlitch());
          }
          break;
        case 'flicker':
          if (Math.random() < intensity * 0.3) {
            setFlickerOn((prev) => !prev);
          }
          break;
      }
    };

    intervalRef.current = setInterval(animate, speed);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [effect, speed, palette.length, generateGlitch, children.length, intensity]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Render based on effect type
  const renderText = () => {
    switch (effect) {
      case 'static':
        return (
          <Text color={baseColor} bold={bold} dimColor={dim} underline={underline}>
            {children}
          </Text>
        );

      case 'pulse':
        return (
          <Text
            color={palette[frame]}
            bold={bold || frame === 0}
            dimColor={dim || frame === palette.length - 1}
            underline={underline}
          >
            {children}
          </Text>
        );

      case 'rainbow':
      case 'neon':
        return (
          <Text color={palette[frame]} bold={bold} dimColor={dim} underline={underline}>
            {children}
          </Text>
        );

      case 'wave':
        // Each character gets a color based on position and frame
        return (
          <>
            {children.split('').map((char, index) => (
              <Text
                key={index}
                color={palette[(index + frame) % palette.length]}
                bold={bold}
                dimColor={dim}
              >
                {char}
              </Text>
            ))}
          </>
        );

      case 'gradient':
        // Static gradient across characters
        const gradientStep = palette.length / Math.max(children.length, 1);
        return (
          <>
            {children.split('').map((char, index) => (
              <Text
                key={index}
                color={palette[Math.floor((index * gradientStep + frame) % palette.length)]}
                bold={bold}
                dimColor={dim}
              >
                {char}
              </Text>
            ))}
          </>
        );

      case 'glitch':
        return (
          <Text color={baseColor} bold={bold} dimColor={dim} underline={underline}>
            {glitchText}
          </Text>
        );

      case 'typewriter':
        return (
          <Text color={baseColor} bold={bold} dimColor={dim} underline={underline}>
            {children.slice(0, typewriterIndex)}
            <Text color="white">{'█'}</Text>
          </Text>
        );

      case 'matrix':
        return (
          <>
            {children.split('').map((char, index) => {
              const colorIndex = (index + frame) % palette.length;
              return (
                <Text
                  key={index}
                  color={palette[colorIndex]}
                  bold={colorIndex === 2}
                  dimColor={colorIndex > 3}
                >
                  {char}
                </Text>
              );
            })}
          </>
        );

      case 'flicker':
        return (
          <Text
            color={flickerOn ? baseColor : 'gray'}
            bold={bold && flickerOn}
            dimColor={!flickerOn}
            underline={underline}
          >
            {children}
          </Text>
        );

      default:
        return (
          <Text color={baseColor} bold={bold} dimColor={dim} underline={underline}>
            {children}
          </Text>
        );
    }
  };

  return <>{renderText()}</>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEONTITLE - Large title with glow effect simulation
// ═══════════════════════════════════════════════════════════════════════════════

interface NeonTitleProps {
  children: string;
  color?: string;
  glowColor?: string;
  animated?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function NeonTitle({
  children,
  color = 'cyanBright',
  glowColor = 'cyan',
  animated = true,
  size = 'medium',
}: NeonTitleProps) {
  const [glowing, setGlowing] = useState(true);

  useEffect(() => {
    if (!animated) return;

    const interval = setInterval(() => {
      setGlowing((prev) => !prev);
    }, 500);

    return () => clearInterval(interval);
  }, [animated]);

  const prefix = size === 'large' ? '>>> ' : size === 'medium' ? '>> ' : '> ';
  const suffix = size === 'large' ? ' <<<' : size === 'medium' ? ' <<' : ' <';

  return (
    <Box>
      <Text color={glowColor} dimColor={!glowing}>
        {prefix}
      </Text>
      <Text color={color} bold>
        {children.toUpperCase()}
      </Text>
      <Text color={glowColor} dimColor={!glowing}>
        {suffix}
      </Text>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERLABEL - Styled label with optional value
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberLabelProps {
  label: string;
  value?: string;
  labelColor?: string;
  valueColor?: string;
  separator?: string;
  prefix?: string;
  suffix?: string;
}

export function CyberLabel({
  label,
  value,
  labelColor = 'cyan',
  valueColor = 'white',
  separator = ':',
  prefix = '',
  suffix = '',
}: CyberLabelProps) {
  return (
    <Box>
      {prefix && <Text color="gray">{prefix}</Text>}
      <Text color={labelColor} bold>
        {label}
      </Text>
      {value !== undefined && (
        <>
          <Text color="gray">{separator} </Text>
          <Text color={valueColor}>{value}</Text>
        </>
      )}
      {suffix && <Text color="gray">{suffix}</Text>}
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERLINK - Styled link/command reference
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberLinkProps {
  children: string;
  type?: 'command' | 'link' | 'file' | 'code';
}

export function CyberLink({ children, type = 'command' }: CyberLinkProps) {
  const styles = {
    command: { color: 'yellowBright', prefix: '/', suffix: '' },
    link: { color: 'blueBright', prefix: '', suffix: '' },
    file: { color: 'greenBright', prefix: '@', suffix: '' },
    code: { color: 'magentaBright', prefix: '`', suffix: '`' },
  };

  const style = styles[type];

  return (
    <Text color={style.color} underline={type === 'link'}>
      {style.prefix}
      {children}
      {style.suffix}
    </Text>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HIGHLIGHT - Inline highlighted text
// ═══════════════════════════════════════════════════════════════════════════════

interface HighlightProps {
  children: string;
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
}

export function Highlight({ children, variant = 'default' }: HighlightProps) {
  const colors = {
    default: 'cyanBright',
    success: 'greenBright',
    error: 'redBright',
    warning: 'yellowBright',
    info: 'blueBright',
  };

  return (
    <Text color={colors[variant]} bold>
      {children}
    </Text>
  );
}
