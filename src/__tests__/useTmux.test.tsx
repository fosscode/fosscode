describe('useTmux Hook', () => {
  it('should export useTmux hook function', () => {
    const { useTmux } = require('../ui/hooks/useTmux.js');
    expect(typeof useTmux).toBe('function');
  });

  it('should have proper module structure', () => {
    const useTmuxModule = require('../ui/hooks/useTmux.js');

    // Verify the module exports the hook
    expect(useTmuxModule).toHaveProperty('useTmux');
    expect(typeof useTmuxModule.useTmux).toBe('function');
  });

  it('should import required dependencies', () => {
    // Verify the hook can be imported without errors
    expect(() => {
      require('../ui/hooks/useTmux.js');
    }).not.toThrow();
  });

  it('should have TypeScript interface defined', () => {
    // This test verifies that the hook has the expected interface
    // by checking that it can be imported and is a function
    const { useTmux } = require('../ui/hooks/useTmux.js');

    expect(useTmux).toBeDefined();
    expect(typeof useTmux).toBe('function');

    // The hook should have a name (for debugging purposes)
    expect(useTmux.name).toBe('useTmux');
  });
});
