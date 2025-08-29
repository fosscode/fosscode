# Responsive Design for Mobile Terminals

This document describes the responsive design features implemented in fosscode to support small window sizes, particularly for mobile terminals.

## Features

### 1. Adaptive Header

- **Desktop (>60 cols)**: `🤖 fosscode - provider (model)`
- **Tablet (40-60 cols)**: `🤖 fosscode - provider`
- **Mobile (<40 cols)**: `🤖 provider`

### 2. Compact Message Labels

- **Desktop/Tablet**: `You: ` and `Assistant: `
- **Mobile**: `> ` and `< ` (shorter prefixes)

### 3. Responsive Input Area

- **Desktop**: `> Type your message... (Ctrl+C to exit)`
- **Tablet**: `> Type message...`
- **Mobile**: `$ Msg...`

### 4. Conditional Footer

- **Desktop/Tablet**: Full help text with all commands
- **Mobile**: Footer hidden to save space

### 5. Compact Loading Messages

- **Desktop/Tablet**: Full messages with emojis (`🤔 Thinking deeply...`)
- **Mobile**: Short messages without emojis (`Thinking...`)

## Breakpoints

- **Small Screen**: Width < 60 columns OR height < 15 rows
- **Very Small Screen**: Width < 40 columns OR height < 10 rows

## Testing

The responsive design is tested through e2e tests that verify:

1. **UI Elements**: App starts and shows appropriate elements for screen size
2. **Special Commands**: Help text adapts to available space
3. **Small Windows**: App handles very small terminal sizes gracefully
4. **Code Coverage**: Responsive logic is present in the codebase

### Running Tests

```bash
bun run test -- --testPathPattern=e2e
```

### Manual Testing

To test responsive behavior manually:

```bash
# Simulate small terminal
COLUMNS=50 LINES=15 node dist/index.js chat --provider sonicfree

# Simulate very small terminal
COLUMNS=35 LINES=10 node dist/index.js chat --provider sonicfree
```

## Implementation Details

### Components with Responsive Design

1. **App.tsx**: Main UI component with adaptive header, messages, and footer
2. **LoadingIndicator.tsx**: Compact messages for small screens
3. **InteractiveLoading.tsx**: Already had tmux detection (similar to mobile)

### Technical Approach

- Uses Ink's `useStdout` hook to detect terminal dimensions
- Applies responsive logic based on `stdout.columns` and `stdout.rows`
- Gracefully handles cases where terminal size detection fails
- Maintains functionality while optimizing space usage

## Tmux Support

fosscode provides comprehensive support for tmux (terminal multiplexer) environments to ensure optimal user experience in multiplexed terminal sessions.

### Tmux Detection

- **Automatic Detection**: The application automatically detects when running inside tmux
- **Pane Size Awareness**: Adapts to individual tmux pane dimensions rather than the full terminal size
- **Dynamic Updates**: Responds to tmux pane resizing in real-time

### Tmux-Specific Features

1. **Pane-Aware Responsiveness**: Uses tmux pane dimensions for responsive breakpoints instead of full terminal size
2. **Status Line Integration**: Compatible with tmux status lines and pane borders
3. **Split Pane Support**: Works seamlessly in tmux split-pane layouts
4. **Session Persistence**: Maintains state across tmux session detach/reattach

### Implementation Details

- **Detection Method**: Uses environment variables and terminal capabilities to identify tmux sessions
- **Size Detection**: Queries tmux for actual pane dimensions when available
- **Fallback Behavior**: Gracefully falls back to standard terminal detection if tmux detection fails
- **Performance**: Minimal overhead when running outside tmux environments

### Testing Tmux Support

```bash
# Test in tmux pane
tmux new-session -d -s test
tmux send-keys -t test 'cd /path/to/fosscode && node dist/index.js chat --provider sonicfree' C-m
tmux attach-session -t test

# Test responsive behavior in different pane sizes
# Split panes and resize to test breakpoints
```

## Future Enhancements

Potential improvements for even better mobile support:

1. **Horizontal Scrolling**: For very long messages
2. **Touch-Friendly**: Larger touch targets (though limited by terminal constraints)
3. **Alternative Layouts**: Single-column vs multi-column layouts
4. **Configurable Breakpoints**: User-defined responsive breakpoints
