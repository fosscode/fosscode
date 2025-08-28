import { useState, useEffect } from 'react';
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

export function FlashyText({ children, type = 'rainbow', speed = 500, colors }: FlashyTextProps) {
  const [colorIndex, setColorIndex] = useState(0);
  const [waveOffset, setWaveOffset] = useState(0);
  const [flashState, setFlashState] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      switch (type) {
        case 'rainbow':
        case 'pulse':
        case 'neon':
          setColorIndex(prev => (prev + 1) % (colors || rainbowColors).length);
          break;
        case 'wave':
          setWaveOffset(prev => (prev + 1) % children.length);
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
    }, speed);

    return () => clearInterval(interval);
  }, [type, speed, children.length, colors]);

  const getColor = (charIndex?: number): string => {
    const colorPalette =
      colors ||
      (type === 'neon' ? neonColors : type === 'gradient' ? gradientColors : rainbowColors);

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
  };

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
