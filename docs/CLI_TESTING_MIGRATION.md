# CLI Testing Framework Comparison & Migration Guide

## Current Setup vs CLI Testing Library

### Current Jest + Custom Mocks Setup

**✅ What's Working:**

- All E2E tests pass (5/5 InteractiveChat, 1/1 ToolExecution, 2/2 MultiTurnConversation)
- Mock servers work correctly
- Environment variable configuration works
- TypeScript support with ts-jest

**❌ Limitations:**

- Verbose test code with lots of boilerplate
- Manual process management (spawn, cleanup, etc.)
- Limited interactive CLI testing capabilities
- Custom mock server maintenance
- No built-in assertions for CLI-specific features

### CLI Testing Library Benefits

**✅ Advantages:**

- **Modern Testing Library approach** - encourages better testing practices
- **Interactive CLI testing** - real terminal simulation with keyboard input
- **Streaming output support** - handles real-time CLI output
- **Cross-platform** (Windows, Linux, macOS)
- **Rich built-in matchers** - `toBeInTheConsole()`, `findByText()`, etc.
- **Automatic cleanup** - no manual process management
- **Better error messages** - clearer test failures

**❌ Challenges:**

- Integration complexity with existing Jest setup
- Learning curve for new API
- May require different test structure

## Migration Strategy

### Phase 1: Keep Current Setup (Recommended)

Your current Jest + custom mocks setup is **working perfectly** and all tests pass. Consider keeping it for now and enhancing it incrementally.

**Enhancement Ideas:**

```typescript
// Add CLI-specific matchers to your current setup
expect.extend({
  toBeInConsole(output: string, expectedText: string) {
    const pass = output.includes(expectedText);
    return {
      message: () => `expected console output to contain "${expectedText}"`,
      pass,
    };
  },
});

// Use in tests
expect(output).toBeInConsole('Available commands');
```

### Phase 2: Gradual Migration (Future)

If you want to migrate later:

1. **Start with simple tests** - migrate one test file at a time
2. **Keep mock servers** - your current mock approach works well
3. **Use hybrid approach** - combine both frameworks during transition

### Phase 3: Full Migration (Optional)

Complete migration when:

- Team is comfortable with new patterns
- Current setup shows limitations
- More complex interactive features need testing

## Comparison Examples

### Current Approach (Jest + Custom)

```typescript
test('should handle help command', async () => {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Test timed out'));
    }, 5000);

    const child = spawn('bun', ['run', 'src/index.ts', '--help'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    let output = '';
    child.stdout?.on('data', data => {
      output += data.toString();
    });

    child.on('exit', code => {
      clearTimeout(timeout);
      expect(code).toBe(0);
      expect(output).toContain('fosscode');
      expect(output).toContain('chat');
      resolve();
    });
  });
}, 10000);
```

### CLI Testing Library Approach

```typescript
test('should handle help command', async () => {
  const { findByText, cleanup } = await render('bun', ['run', 'src/index.ts', '--help']);

  // Wait for help output
  expect(await findByText('fosscode')).toBeInTheConsole();
  expect(await findByText('chat')).toBeInTheConsole();

  cleanup();
});
```

## Recommendation

**Keep your current Jest + custom mocks setup for now.** It's working well and all tests pass. CLI Testing Library is great for future projects or when you need more advanced interactive CLI testing features.

**When to consider migration:**

- Adding complex interactive features
- Team wants modern testing patterns
- Current setup becomes too verbose to maintain

**Next Steps:**

1. Continue using your current setup (it's solid!)
2. Consider CLI Testing Library for future projects
3. Monitor if your testing needs evolve

Your current E2E testing infrastructure is actually quite good and follows proven patterns. Don't fix what isn't broken! 🚀</content>
</xai:function_call">CLI_TESTING_MIGRATION.md
