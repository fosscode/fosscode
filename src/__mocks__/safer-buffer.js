// Replacement for safer-buffer package
// Since we're targeting Node.js 18+, we can use the native Buffer API safely

const { Buffer } = require('buffer');

// Export the native Buffer API which is safe in Node.js 18+
module.exports = {
  Buffer,
  // Copy other buffer module properties
  ...require('buffer'),
};
