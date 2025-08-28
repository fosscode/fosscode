# Integration Testing Documentation

## Overview

This document outlines the integration testing approach for the fosscode TUI application.

## Testing Framework Setup

### Dependencies

- **ink-testing-library**: For testing React components in CLI environment
- **Jest**: Test runner with jsdom environment for React testing
- **@testing-library/jest-dom**: Additional Jest matchers for DOM testing

### Configuration

- Tests are located in `src/__tests__/`
- ES module support with proper import/export syntax
- Mock setup for external dependencies (chalk, fetch, etc.)

## Test Categories

### 1. Unit Tests ✅

- Provider validation
- Configuration management
- Tool registry functionality
- Message queue operations
- Type definitions

### 2. Integration Tests 🔄

**Status**: Framework established, basic tests created

#### Current Implementation

- Basic test structure in `App.basic.test.tsx`
- Memory management function verification
- Conversation history optimization validation

#### Planned Tests

- TUI component rendering and interaction
- Command handling (/clear, /verbose, /themes, /memory, /gc)
- File search functionality
- Mode switching (code/thinking)
- Error handling and edge cases

### 3. End-to-End Tests 🔄

**Status**: Basic E2E structure exists

#### Current Implementation

- Tool execution testing in non-interactive mode
- Verbose mode with tool execution
- File operations testing

#### Issues to Resolve

- ES module compatibility with Jest mocking
- Process exit code handling
- Test environment configuration

## Key Testing Areas

### TUI Functionality

```typescript
// Example test structure
describe('App Integration Tests', () => {
  test('renders welcome message and input prompt', () => {
    const { lastFrame } = render(<App {...props} />);
    expect(lastFrame()).toContain('fosscode');
    expect(lastFrame()).toContain('>'); // Input prompt
  });

  test('handles /clear command', () => {
    const { stdin } = render(<App {...props} />);
    stdin.write('/clear');
    stdin.write('\r');
    expect(lastFrame()).toContain('Conversation cleared');
  });
});
```

### Memory Management

- Conversation history limits (100 messages max)
- Automatic cleanup when memory usage is high
- Memory monitoring commands (/memory, /gc)
- Lazy loading of providers

### Command Handling

- Built-in commands (/clear, /verbose, /themes, /memory, /gc, /mode)
- File search mode (@ symbol activation)
- Mode switching (Tab key, /mode command)
- Error handling for invalid commands

### Provider Integration

- Lazy loading of LLM providers
- Connection pooling with retry logic
- Timeout handling
- Error recovery mechanisms

## Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test -- App.basic.test.tsx

# Run with coverage
bun test --coverage
```

## Test Environment Setup

### Required Configuration

1. **Jest Configuration**: Update `jest.config.js` for ES modules
2. **Mock Setup**: Proper mocking of external dependencies
3. **Environment Variables**: Test-specific configuration
4. **Cleanup**: Proper test isolation and cleanup

### Current Challenges

- Jest ES module mocking compatibility
- Process management in test environment
- TUI interaction simulation

## Next Steps

### Immediate Actions

1. **Fix ES Module Configuration**
   - Update Jest configuration for proper ES module support
   - Resolve `jest.mock` is not a function errors

2. **Complete Integration Tests**
   - Implement full TUI interaction tests
   - Add comprehensive command testing
   - Test error scenarios and edge cases

3. **E2E Test Stabilization**
   - Fix process exit code issues
   - Improve test reliability
   - Add proper cleanup between tests

### Future Enhancements

- Visual regression testing for TUI
- Performance testing integration
- Cross-platform testing automation
- CI/CD integration for automated testing

## Best Practices

### Test Organization

- Group related tests in describe blocks
- Use meaningful test names that describe behavior
- Follow AAA pattern (Arrange, Act, Assert)

### Mock Strategy

- Mock external dependencies (APIs, file system)
- Use spies for internal function calls
- Clean up mocks between tests

### TUI Testing

- Use ink-testing-library for component testing
- Simulate user input with stdin.write()
- Verify output with lastFrame() and frame snapshots
- Test both interactive and non-interactive modes

## Conclusion

The integration testing framework is established with:

- ✅ Test structure and organization
- ✅ Basic test implementation
- ✅ Memory management testing
- 🔄 TUI interaction testing (needs ES module fixes)
- 🔄 E2E testing (needs stability improvements)

The foundation is solid and ready for expansion once the ES module configuration issues are resolved.</content>
</xai:function_call">The file has been modified.
