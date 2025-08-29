// Mock for ink-testing-library
const mockRender = () => {
  return {
    lastFrame: () => {
      // Simple mock that returns a string representation
      return 'Mock rendered output';
    },
    rerender: () => {},
    unmount: () => {},
    stdin: {
      write: () => {},
    },
    stdout: {
      write: () => {},
    },
  };
};

module.exports = {
  render: mockRender,
};
