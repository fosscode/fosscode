import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Text } from 'ink';

interface FlashyTextProps {
  children: string;
  type?: 'rainbow' | 'pulse' | 'wave' | 'flash' | 'gradient' | 'neon' | 'static';
  speed?: number;
  colors?: string[];
}

const rainbowColors = ['yellow', 'green', 'cyan', 'blue', 'magenta', 'gray'];
const neonColors = ['cyan', 'magenta', 'yellow', 'green', 'blue', 'gray'];
const gradientColors = ['blue', 'cyan', 'green', 'yellow', 'magenta', 'gray'];

export function FlashyText({ children, type = 'rainbow', speed = 200, colors }: FlashyTextProps) {
  const [colorIndex, setColorIndex] = useState(0);
  const [waveOffset, setWaveOffset] = useState(0);
  const [flashState, setFlashState] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const childrenRef = useRef<string>(children);

  // Disable animations for very large content to prevent performance issues
  const isLargeContent = children.length > 10000;
  const effectiveType = isLargeContent ? 'static' : type;

  // Clear interval immediately for large content or static type
  const shouldRunAnimation = effectiveType !== 'static' && !isLargeContent;

  const colorPalette = useMemo(() => {
    return (
      colors ||
      (effectiveType === 'neon'
        ? neonColors
        : effectiveType === 'gradient'
          ? gradientColors
          : rainbowColors)
    );
  }, [colors, effectiveType]);

  const updateAnimation = useCallback(() => {
    const now = Date.now();
    // Simple debouncing: don't update if less than 50ms has passed
    if (now - lastUpdateRef.current < 50) {
      return;
    }
    lastUpdateRef.current = now;

    switch (effectiveType) {
      case 'rainbow':
      case 'pulse':
      case 'neon':
        setColorIndex(prev => (prev + 1) % colorPalette.length);
        break;
      case 'wave':
        setWaveOffset(prev => (prev + 1) % Math.max(childrenRef.current.length, 1));
        break;
      case 'flash':
        setFlashState(prev => !prev);
        break;
      case 'gradient':
        setColorIndex(prev => (prev + 1) % gradientColors.length);
        break;
      case 'static':
        // No animation for static type
        break;
    }
  }, [effectiveType, colorPalette.length]);

  // Update children ref when children change
  useEffect(() => {
    childrenRef.current = children;
  }, [children]);

  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only create interval for non-static types and non-large content
    if (shouldRunAnimation) {
      intervalRef.current = setInterval(updateAnimation, speed);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [shouldRunAnimation, speed, updateAnimation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const getColor = useCallback(
    (charIndex?: number): string => {
      switch (effectiveType) {
        case 'wave':
          if (charIndex !== undefined) {
            return colorPalette[(charIndex + waveOffset) % colorPalette.length];
          }
          return colorPalette[colorIndex];
        case 'flash':
          return flashState ? colorPalette[colorIndex] : 'gray';
        default:
          return colorPalette[colorIndex];
      }
    },
    [effectiveType, colorIndex, waveOffset, flashState, colorPalette]
  );

  if (effectiveType === 'wave' && !isLargeContent) {
    return (
      <>
        {children.split('').map((char, index) => (
          <Text key={index} color={getColor(index)}>
            {char}
          </Text>
        ))}
      </>
    );
  }

  return <Text color={getColor()}>{children}</Text>;
}
