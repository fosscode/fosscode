// Mock for ink package
const Box = () => null;
const Text = () => null;

module.exports = {
  Box,
  Text,
  render: () => ({
    rerender: () => {},
    unmount: () => {},
    cleanup: () => {},
  }),
};
