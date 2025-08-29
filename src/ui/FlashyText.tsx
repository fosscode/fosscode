import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Text } from 'ink';

interface FlashyTextProps {
  children: string;
  type?: 'rainbow' | 'pulse' | 'wave' | 'flash' | 'gradient' | 'neon' | 'static';
  speed?: number;
  colors?: string[];
}

const rainbowColors = ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta'];
const neonColors = ['cyan', 'magenta', 'yellow', 'green', 'blue', 'red'];
const gradientColors = ['blue', 'cyan', 'green', 'yellow', 'red', 'magenta'];

export function FlashyText({ children, type = 'rainbow', speed = 200, colors }: FlashyTextProps) {
  const [colorIndex, setColorIndex] = useState(0);
  const [waveOffset, setWaveOffset] = useState(0);
  const [flashState, setFlashState] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const childrenRef = useRef<string>(children);

  const colorPalette = useMemo(() => {
    return (
      colors ||
      (type === 'neon' ? neonColors : type === 'gradient' ? gradientColors : rainbowColors)
    );
  }, [colors, type]);

  const updateAnimation = useCallback(() => {
    const now = Date.now();
    // Simple debouncing: don't update if less than 50ms has passed
    if (now - lastUpdateRef.current < 50) {
      return;
    }
    lastUpdateRef.current = now;

    switch (type) {
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
  }, [type, colorPalette.length]);

  // Update children ref when children change
  useEffect(() => {
    childrenRef.current = children;
  }, [children]);

  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Only create interval for non-static types
    if (type !== 'static') {
      intervalRef.current = setInterval(updateAnimation, speed);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [type, speed, updateAnimation]);

  const getColor = useCallback(
    (charIndex?: number): string => {
      switch (type) {
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
    [type, colorIndex, waveOffset, flashState, colorPalette]
  );

  if (type === 'wave') {
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
