/**
 * CYBERMESSAGES - Stunning message display components
 * Part of the FOSSCODE Cyberpunk UI Framework
 */

import { useMemo, memo, useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { CyberText } from './CyberText.js';
import { CyberSpinner } from './CyberSpinner.js';
import { CyberThemes, CyberSymbols, type CyberThemeColors } from './CyberTheme.js';

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date | undefined;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | undefined;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERMESSAGE - Single message display
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberMessageProps {
  message: Message;
  animated?: boolean;
  showTimestamp?: boolean;
  compact?: boolean;
  theme?: CyberThemeColors;
  themeName?: string;
}

export const CyberMessage = memo(function CyberMessage({
  message,
  animated = false,
  showTimestamp = false,
  compact = false,
  theme,
  themeName = 'neon',
}: CyberMessageProps) {
  const colors = theme || CyberThemes[themeName] || CyberThemes.neon;

  const roleConfig = useMemo(() => ({
    user: {
      icon: '❯',
      label: 'YOU',
      color: colors.userMessage,
      borderColor: colors.success,
      prefix: '◈',
    },
    assistant: {
      icon: '◉',
      label: 'AI',
      color: colors.assistantMessage,
      borderColor: colors.primary,
      prefix: '◇',
    },
    system: {
      icon: '⚙',
      label: 'SYS',
      color: colors.warning,
      borderColor: colors.warning,
      prefix: '⊡',
    },
  }), [colors]);

  const config = roleConfig[message.role];

  // Format timestamp
  const formattedTime = useMemo(() => {
    if (!message.timestamp || !showTimestamp) return null;
    return message.timestamp.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }, [message.timestamp, showTimestamp]);

  if (compact) {
    return (
      <Box marginBottom={1}>
        <Text color={config.color} bold>
          {config.prefix}{' '}
        </Text>
        <Text color={colors.text}>{message.content}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Message header */}
      <Box>
        <Text color={config.borderColor}>{config.icon} </Text>
        <Text color={config.color} bold>
          {config.label}
        </Text>
        {formattedTime && (
          <>
            <Text color={colors.muted}>{' │ '}</Text>
            <Text color={colors.textDim}>{formattedTime}</Text>
          </>
        )}
        {message.usage && (
          <>
            <Text color={colors.muted}>{' │ '}</Text>
            <Text color={colors.textDim}>
              {CyberSymbols.data} {message.usage.totalTokens.toLocaleString()}
            </Text>
          </>
        )}
      </Box>

      {/* Message content */}
      <Box marginLeft={2}>
        <Text color={config.borderColor}>{'│ '}</Text>
        {animated && message.role === 'assistant' ? (
          <CyberText effect="typewriter" color={colors.text} speed={30}>
            {message.content}
          </CyberText>
        ) : (
          <Text color={colors.text} wrap="wrap">
            {message.content}
          </Text>
        )}
      </Box>
    </Box>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERMESSAGELIST - Message list with scroll support
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberMessageListProps {
  messages: Message[];
  isLoading?: boolean;
  error?: string | null;
  scrollOffset?: number;
  maxVisibleMessages?: number;
  showTimestamp?: boolean;
  compact?: boolean;
  theme?: CyberThemeColors;
  themeName?: string;
}

export const CyberMessageList = memo(function CyberMessageList({
  messages,
  isLoading = false,
  error = null,
  scrollOffset = 0,
  maxVisibleMessages = 50,
  showTimestamp = false,
  compact = false,
  theme,
  themeName = 'neon',
}: CyberMessageListProps) {
  const colors = theme || CyberThemes[themeName] || CyberThemes.neon;

  // Calculate visible messages with scroll
  const visibleMessages = useMemo(() => {
    const startIndex = Math.max(0, messages.length - maxVisibleMessages - scrollOffset);
    const endIndex = messages.length - scrollOffset;
    return messages.slice(startIndex, endIndex);
  }, [messages, scrollOffset, maxVisibleMessages]);

  return (
    <Box flexDirection="column" flexGrow={1} marginBottom={1}>
      {/* Scroll indicator at top */}
      {scrollOffset > 0 && (
        <Box>
          <Text color={colors.textDim}>
            {CyberSymbols.arrowUp} {scrollOffset} more messages above {CyberSymbols.arrowUp}
          </Text>
        </Box>
      )}

      {/* Messages */}
      {visibleMessages.map((message, index) => (
        <CyberMessage
          key={`${message.timestamp?.getTime() || index}-${index}`}
          message={message}
          showTimestamp={showTimestamp}
          compact={compact}
          theme={colors}
        />
      ))}

      {/* Loading indicator */}
      {isLoading && (
        <Box marginTop={1}>
          <CyberSpinner
            style="cyberDots"
            messageTheme="ai"
            theme={colors}
            size="medium"
          />
        </Box>
      )}

      {/* Error display */}
      {error && (
        <CyberErrorMessage message={error} theme={colors} />
      )}
    </Box>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERERRORMESSAGE - Error display with style
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberErrorMessageProps {
  message: string;
  title?: string;
  theme?: CyberThemeColors;
  themeName?: string;
}

export function CyberErrorMessage({
  message,
  title = 'ERROR',
  theme,
  themeName = 'neon',
}: CyberErrorMessageProps) {
  const colors = theme || CyberThemes[themeName] || CyberThemes.neon;
  const [pulseFrame, setPulseFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulseFrame((prev) => (prev + 1) % 2);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color={colors.error}>{'╭─'}</Text>
        <Text color={pulseFrame === 0 ? colors.error : colors.warning}>{'⚠'}</Text>
        <Text color={colors.error}>{'─['}</Text>
        <Text color={colors.error} bold>
          {title}
        </Text>
        <Text color={colors.error}>{']─'.padEnd(40, '─')}</Text>
        <Text color={colors.error}>{'╮'}</Text>
      </Box>

      <Box>
        <Text color={colors.error}>{'│ '}</Text>
        <Text color={colors.text}>{message}</Text>
      </Box>

      <Box>
        <Text color={colors.error}>{'╰'}</Text>
        <Text color={colors.error}>{'─'.repeat(50)}</Text>
        <Text color={colors.error}>{'╯'}</Text>
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERSUCCESSMESSAGE - Success display
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberSuccessMessageProps {
  message: string;
  title?: string;
  theme?: CyberThemeColors;
  themeName?: string;
}

export function CyberSuccessMessage({
  message,
  title = 'SUCCESS',
  theme,
  themeName = 'neon',
}: CyberSuccessMessageProps) {
  const colors = theme || CyberThemes[themeName] || CyberThemes.neon;

  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color={colors.success}>{'╭─✓─['}</Text>
        <Text color={colors.success} bold>
          {title}
        </Text>
        <Text color={colors.success}>{']─'.padEnd(40, '─')}</Text>
        <Text color={colors.success}>{'╮'}</Text>
      </Box>

      <Box>
        <Text color={colors.success}>{'│ '}</Text>
        <Text color={colors.text}>{message}</Text>
      </Box>

      <Box>
        <Text color={colors.success}>{'╰'}</Text>
        <Text color={colors.success}>{'─'.repeat(50)}</Text>
        <Text color={colors.success}>{'╯'}</Text>
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERWELCOMEMESSAGE - Welcome/intro message
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberWelcomeMessageProps {
  title?: string;
  subtitle?: string;
  tips?: string[];
  theme?: CyberThemeColors;
  themeName?: string;
}

export function CyberWelcomeMessage({
  title = 'Welcome to FOSSCODE',
  subtitle = 'Free Open-Source Software Code Assistant',
  tips = [
    'Type your question or command to get started',
    'Use /help for available commands',
    'Press Tab to toggle between Code and Thinking modes',
    'Use @ to attach files to your message',
  ],
  theme,
  themeName = 'neon',
}: CyberWelcomeMessageProps) {
  const colors = theme || CyberThemes[themeName] || CyberThemes.neon;

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Title */}
      <Box>
        <CyberText effect="wave" color={colors.primary} colors={[colors.primary, colors.secondary, colors.accent]}>
          {`◈ ${title} ◈`}
        </CyberText>
      </Box>

      {/* Subtitle */}
      <Box marginTop={1}>
        <Text color={colors.textDim}>{subtitle}</Text>
      </Box>

      {/* Divider */}
      <Box marginY={1}>
        <Text color={colors.border}>{'─'.repeat(50)}</Text>
      </Box>

      {/* Tips */}
      <Box flexDirection="column">
        {tips.map((tip, index) => (
          <Box key={index}>
            <Text color={colors.accent}>{CyberSymbols.chevronRight} </Text>
            <Text color={colors.text}>{tip}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CYBERTHINKINGBLOCK - Thinking/reasoning display
// ═══════════════════════════════════════════════════════════════════════════════

interface CyberThinkingBlockProps {
  content: string;
  collapsed?: boolean;
  theme?: CyberThemeColors;
  themeName?: string;
}

export function CyberThinkingBlock({
  content,
  collapsed = false,
  theme,
  themeName = 'neon',
}: CyberThinkingBlockProps) {
  const colors = theme || CyberThemes[themeName] || CyberThemes.neon;

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Header */}
      <Box>
        <Text color={colors.warning}>{'╭─🧠─['}</Text>
        <Text color={colors.warning} bold>
          THINKING
        </Text>
        <Text color={colors.warning}>{']─'}</Text>
        <Text color={colors.textDim}>
          {collapsed ? ' (click to expand)' : ''}
        </Text>
        <Box flexGrow={1}>
          <Text color={colors.warning}>{'─'}</Text>
        </Box>
        <Text color={colors.warning}>{'╮'}</Text>
      </Box>

      {/* Content */}
      {!collapsed && (
        <Box>
          <Text color={colors.warning}>{'│ '}</Text>
          <Text color={colors.textDim} italic wrap="wrap">
            {content}
          </Text>
        </Box>
      )}

      {/* Footer */}
      <Box>
        <Text color={colors.warning}>{'╰'}</Text>
        <Text color={colors.warning}>{'─'.repeat(50)}</Text>
        <Text color={colors.warning}>{'╯'}</Text>
      </Box>
    </Box>
  );
}
