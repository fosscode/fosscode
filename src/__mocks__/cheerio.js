// Mock for cheerio ES module
module.exports = {
  load: jest.fn(() => ({
    $: jest.fn(),
    text: jest.fn(() => 'mocked text'),
    html: jest.fn(() => 'mocked html'),
    find: jest.fn(() => []),
    attr: jest.fn(),
    each: jest.fn(),
  })),
  default: {
    load: jest.fn(() => ({
      $: jest.fn(),
      text: jest.fn(() => 'mocked text'),
      html: jest.fn(() => 'mocked html'),
      find: jest.fn(() => []),
      attr: jest.fn(),
      each: jest.fn(),
    })),
  },
};
