const chalk = jest.fn(text => text);

// Add common chalk methods
chalk.red = jest.fn(text => text);
chalk.green = jest.fn(text => text);
chalk.yellow = jest.fn(text => text);
chalk.blue = jest.fn(text => text);
chalk.cyan = jest.fn(text => text);
chalk.magenta = jest.fn(text => text);
chalk.white = jest.fn(text => text);
chalk.gray = jest.fn(text => text);
chalk.black = jest.fn(text => text);
chalk.bgRed = jest.fn(text => text);
chalk.bgGreen = jest.fn(text => text);
chalk.bgYellow = jest.fn(text => text);
chalk.bgBlue = jest.fn(text => text);
chalk.bgCyan = jest.fn(text => text);
chalk.bgMagenta = jest.fn(text => text);
chalk.bgWhite = jest.fn(text => text);
chalk.bold = jest.fn(text => text);
chalk.dim = jest.fn(text => text);
chalk.italic = jest.fn(text => text);
chalk.underline = jest.fn(text => text);
chalk.inverse = jest.fn(text => text);
chalk.strikethrough = jest.fn(text => text);
chalk.reset = jest.fn(text => text);
chalk.stripColor = jest.fn(text => text);

module.exports = chalk;
