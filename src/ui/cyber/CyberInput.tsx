/**
 * CYBERINPUT - Stunning input prompt with visual feedback
 * Part of the FOSSCODE Cyberpunk UI Framework
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text } from 'ink';
import { CyberText } from './CyberText.js';
import { CyberThemes, CyberSymbols, type CyberThemeColors } from './CyberTheme.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERINPUT - Main input component
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberInputProps {
  value: string;
  mode: 'code' | 'thinking';
  placeholder?: string;
  prefix?: string;
  theme?: CyberThemeColors;
  themeName?: string;
  showCursor?: boolean;
  cursorBlink?: boolean;
  showModeIndicator?: boolean;
  compact?: boolean;
  isActive?: boolean;
}

export function CyberInput({
  value,
  mode,
  placeholder = 'Enter command...',
  prefix,
  theme,
  themeName = 'neon',
  showCursor = true,
  cursorBlink = true,
  showModeIndicator = true,
  compact = false,
  isActive = true,
}: CyberInputProps) {
  const colors = theme || CyberThemes[themeName] || CyberThemes.neon;
  const [cursorVisible, setCursorVisible] = useState(true);

  // Cursor blink effect
  useEffect(() => {
    if (!cursorBlink || !isActive) return;

    const interval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 530);

    return () => clearInterval(interval);
  }, [cursorBlink, isActive]);

  // Mode-specific styling
  const modeConfig = useMemo(() => ({
    code: {
      icon: '⚡',
      label: 'CODE',
      color: colors.success,
      borderColor: colors.success,
      promptChar: '❯',
    },
    thinking: {
      icon: '🧠',
      label: 'THINK',
      color: colors.warning,
      borderColor: colors.warning,
      promptChar: '⟩',
    },
  }), [colors]);

  const currentMode = modeConfig[mode];
  const defaultPrefix = prefix || currentMode.promptChar;

  // Cursor character
  const cursor = showCursor && isActive ? (
    <Text color={cursorVisible ? colors.accent : 'transparent'} bold>
      {'█'}
    </Text>
  ) : null;

  if (compact) {
    // Compact single-line input
    return (
      <Box>
        <Text color={currentMode.color}>{defaultPrefix} </Text>
        {value ? (
          <>
            <Text color={colors.text}>{value}</Text>
            {cursor}
          </>
        ) : (
          <Text color={colors.textDim}>{placeholder}</Text>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Input border top */}
      <Box>
        <Text color={currentMode.borderColor}>{'╭─'}</Text>
        {showModeIndicator && (
          <>
            <Text color={currentMode.color}>[</Text>
            <Text color={currentMode.color}>{currentMode.icon}</Text>
            <Text color={currentMode.color} bold> {currentMode.label}</Text>
            <Text color={currentMode.color}>]</Text>
          </>
        )}
        <Text color={currentMode.borderColor}>
          {'─'.repeat(50)}
        </Text>
        <Text color={currentMode.borderColor}>{'╮'}</Text>
      </Box>

      {/* Input line */}
      <Box>
        <Text color={currentMode.borderColor}>{'│ '}</Text>
        <Text color={currentMode.color} bold>
          {defaultPrefix}
        </Text>
        <Text color={colors.muted}>{' '}</Text>

        {value ? (
          <>
            <Text color={colors.text}>{value}</Text>
            {cursor}
          </>
        ) : (
          <CyberText effect="pulse" color={colors.textDim} speed={1000}>
            {placeholder}
          </CyberText>
        )}

        <Box flexGrow={1} />
        <Text color={currentMode.borderColor}>{' │'}</Text>
      </Box>

      {/* Input border bottom */}
      <Box>
        <Text color={currentMode.borderColor}>{'╰'}</Text>
        <Text color={currentMode.borderColor}>
          {'─'.repeat(60)}
        </Text>
        <Text color={currentMode.borderColor}>{'╯'}</Text>
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERCOMMANDLINE - Full command line with prefix and suggestions
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberCommandLineProps {
  value: string;
  mode: 'code' | 'thinking';
  path?: string;
  branch?: string;
  suggestions?: string[];
  selectedSuggestion?: number;
  theme?: CyberThemeColors;
  themeName?: string;
}

export function CyberCommandLine({
  value,
  mode,
  path = '~',
  branch,
  suggestions = [],
  selectedSuggestion = 0,
  theme,
  themeName = 'neon',
}: CyberCommandLineProps) {
  const colors = theme || CyberThemes[themeName] || CyberThemes.neon;
  const [cursorVisible, setCursorVisible] = useState(true);

  // Cursor blink
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  const modeColor = mode === 'code' ? colors.success : colors.warning;
  const modeIcon = mode === 'code' ? '⚡' : '🧠';

  return (
    <Box flexDirection="column">
      {/* Path and branch info */}
      <Box>
        <Text color={colors.secondary}>{CyberSymbols.pointer} </Text>
        <Text color={colors.info}>{path}</Text>
        {branch && (
          <>
            <Text color={colors.muted}>{' on '}</Text>
            <Text color={colors.accent}>{CyberSymbols.node} {branch}</Text>
          </>
        )}
        <Text color={colors.muted}>{' ['}</Text>
        <Text color={modeColor}>{modeIcon} {mode.toUpperCase()}</Text>
        <Text color={colors.muted}>{']'}</Text>
      </Box>

      {/* Command input */}
      <Box>
        <Text color={modeColor} bold>{'❯❯ '}</Text>
        <Text color={colors.text}>{value}</Text>
        <Text color={cursorVisible ? colors.accent : 'transparent'} bold>
          {'█'}
        </Text>
      </Box>

      {/* Suggestions dropdown */}
      {suggestions.length > 0 && (
        <Box flexDirection="column" marginTop={1} marginLeft={3}>
          {suggestions.slice(0, 5).map((suggestion, index) => (
            <Box key={suggestion}>
              <Text color={index === selectedSuggestion ? colors.accent : colors.muted}>
                {index === selectedSuggestion ? '▶ ' : '  '}
              </Text>
              <Text
                color={index === selectedSuggestion ? colors.text : colors.textDim}
                bold={index === selectedSuggestion}
              >
                {suggestion}
              </Text>
            </Box>
          ))}
          {suggestions.length > 5 && (
            <Text color={colors.textDim}>  ... and {suggestions.length - 5} more</Text>
          )}
        </Box>
      )}
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERPROMPT - Simple prompt display
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberPromptProps {
  mode: 'code' | 'thinking';
  animated?: boolean;
  theme?: CyberThemeColors;
  themeName?: string;
}

export function CyberPrompt({
  mode,
  animated = true,
  theme,
  themeName = 'neon',
}: CyberPromptProps) {
  const colors = theme || CyberThemes[themeName] || CyberThemes.neon;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!animated) return;

    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % 4);
    }, 200);

    return () => clearInterval(interval);
  }, [animated]);

  const promptChars = ['❯', '❯', '▶', '▶'];
  const modeColor = mode === 'code' ? colors.success : colors.warning;

  return (
    <Text color={modeColor} bold>
      {animated ? promptChars[frame] : '❯'}
      {' '}
    </Text>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERSEARCHBOX - Search input with results
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberSearchBoxProps {
  query: string;
  results: Array<{ name: string; path?: string; type?: string }>;
  selectedIndex: number;
  isSearching?: boolean;
  placeholder?: string;
  theme?: CyberThemeColors;
  themeName?: string;
}

export function CyberSearchBox({
  query,
  results,
  selectedIndex,
  isSearching = false,
  placeholder = 'Search files...',
  theme,
  themeName = 'neon',
}: CyberSearchBoxProps) {
  const colors = theme || CyberThemes[themeName] || CyberThemes.neon;

  return (
    <Box flexDirection="column">
      {/* Search input */}
      <Box>
        <Text color={colors.border}>{'╭─['}</Text>
        <Text color={colors.accent}>{'🔍'}</Text>
        <Text color={colors.border}>{']─'}</Text>
        <Text color={colors.border}>{'─'.repeat(30)}</Text>
        <Text color={colors.border}>{'╮'}</Text>
      </Box>

      <Box>
        <Text color={colors.border}>{'│ '}</Text>
        {isSearching ? (
          <CyberText effect="pulse" color={colors.info}>
            {'Searching...'}
          </CyberText>
        ) : query ? (
          <Text color={colors.text}>{query}</Text>
        ) : (
          <Text color={colors.textDim}>{placeholder}</Text>
        )}
        <Box flexGrow={1} />
        <Text color={colors.border}>{' │'}</Text>
      </Box>

      {/* Results */}
      {results.length > 0 && (
        <>
          <Box>
            <Text color={colors.border}>{'├'}</Text>
            <Text color={colors.muted}>{'─'.repeat(40)}</Text>
            <Text color={colors.border}>{'┤'}</Text>
          </Box>

          {results.slice(0, 8).map((result, index) => (
            <Box key={result.name + index}>
              <Text color={colors.border}>{'│ '}</Text>
              <Text color={index === selectedIndex ? colors.accent : colors.muted}>
                {index === selectedIndex ? '▶ ' : '  '}
              </Text>
              <Text color={result.type === 'dir' ? colors.info : colors.text}>
                {result.type === 'dir' ? '📁 ' : '📄 '}
              </Text>
              <Text
                color={index === selectedIndex ? colors.accent : colors.text}
                bold={index === selectedIndex}
              >
                {result.name}
              </Text>
              {result.path && (
                <Text color={colors.textDim}>{' ' + result.path}</Text>
              )}
              <Box flexGrow={1} />
              <Text color={colors.border}>{' │'}</Text>
            </Box>
          ))}

          {results.length > 8 && (
            <Box>
              <Text color={colors.border}>{'│ '}</Text>
              <Text color={colors.textDim}>
                {'  ... and ' + (results.length - 8) + ' more results'}
              </Text>
              <Box flexGrow={1} />
              <Text color={colors.border}>{' │'}</Text>
            </Box>
          )}
        </>
      )}

      {/* Bottom border */}
      <Box>
        <Text color={colors.border}>{'╰'}</Text>
        <Text color={colors.border}>{'─'.repeat(40)}</Text>
        <Text color={colors.border}>{'╯'}</Text>
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERHINTSBAR - Keyboard hints/shortcuts bar
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberHintsBarProps {
  hints: Array<{ key: string; action: string }>;
  theme?: CyberThemeColors;
  themeName?: string;
}

export function CyberHintsBar({
  hints,
  theme,
  themeName = 'neon',
}: CyberHintsBarProps) {
  const colors = theme || CyberThemes[themeName] || CyberThemes.neon;

  return (
    <Box>
      {hints.map((hint, index) => (
        <React.Fragment key={hint.key}>
          {index > 0 && <Text color={colors.muted}>{' │ '}</Text>}
          <Text color={colors.accent} bold>
            {hint.key}
          </Text>
          <Text color={colors.textDim}>{' ' + hint.action}</Text>
        </React.Fragment>
      ))}
    </Box>
  );
}
