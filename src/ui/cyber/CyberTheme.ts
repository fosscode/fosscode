/**
 * FOSSCODE CYBERPUNK THEME SYSTEM
 * A stunning neon-drenched terminal UI framework
 */

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR PALETTES - Electric neon cyberpunk colors
// ═══════════════════════════════════════════════════════════════════════════════

export const CyberColors = {
  // Primary neon colors
  neonCyan: '#00FFFF',
  neonMagenta: '#FF00FF',
  neonPink: '#FF1493',
  neonBlue: '#00BFFF',
  neonGreen: '#00FF41',
  neonYellow: '#FFE700',
  neonOrange: '#FF6B00',
  neonRed: '#FF0040',
  neonPurple: '#BF00FF',

  // Terminal-compatible versions (8-bit)
  cyan: 'cyan',
  magenta: 'magenta',
  pink: 'magentaBright',
  blue: 'blueBright',
  green: 'greenBright',
  yellow: 'yellowBright',
  orange: 'yellow',
  red: 'redBright',
  purple: 'magenta',

  // Dark backgrounds
  darkBg: 'black',
  darkGray: 'gray',
  dimGray: 'blackBright',

  // Accent colors
  white: 'white',
  whiteBright: 'whiteBright',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// THEME DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface CyberThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  muted: string;
  text: string;
  textDim: string;
  border: string;
  borderGlow: string;
  headerGlow: string;
  inputPrompt: string;
  userMessage: string;
  assistantMessage: string;
  codeBlock: string;
  highlight: string;
}

export const CyberThemes: Record<string, CyberThemeColors> = {
  // Default neon theme - electric cyan and magenta
  neon: {
    primary: 'cyan',
    secondary: 'magenta',
    accent: 'yellowBright',
    success: 'greenBright',
    warning: 'yellow',
    error: 'redBright',
    info: 'blueBright',
    muted: 'gray',
    text: 'white',
    textDim: 'gray',
    border: 'cyan',
    borderGlow: 'cyanBright',
    headerGlow: 'cyan',
    inputPrompt: 'magenta',
    userMessage: 'greenBright',
    assistantMessage: 'cyanBright',
    codeBlock: 'yellow',
    highlight: 'magentaBright',
  },

  // Matrix theme - green on black
  matrix: {
    primary: 'greenBright',
    secondary: 'green',
    accent: 'whiteBright',
    success: 'greenBright',
    warning: 'yellow',
    error: 'red',
    info: 'green',
    muted: 'gray',
    text: 'greenBright',
    textDim: 'green',
    border: 'green',
    borderGlow: 'greenBright',
    headerGlow: 'greenBright',
    inputPrompt: 'greenBright',
    userMessage: 'whiteBright',
    assistantMessage: 'greenBright',
    codeBlock: 'green',
    highlight: 'whiteBright',
  },

  // Synthwave theme - pink and purple
  synthwave: {
    primary: 'magentaBright',
    secondary: 'blueBright',
    accent: 'cyanBright',
    success: 'greenBright',
    warning: 'yellow',
    error: 'redBright',
    info: 'blueBright',
    muted: 'gray',
    text: 'whiteBright',
    textDim: 'magenta',
    border: 'magenta',
    borderGlow: 'magentaBright',
    headerGlow: 'magentaBright',
    inputPrompt: 'cyanBright',
    userMessage: 'yellowBright',
    assistantMessage: 'magentaBright',
    codeBlock: 'blueBright',
    highlight: 'cyanBright',
  },

  // Blade Runner theme - orange and blue
  bladerunner: {
    primary: 'yellow',
    secondary: 'blueBright',
    accent: 'redBright',
    success: 'greenBright',
    warning: 'yellow',
    error: 'redBright',
    info: 'blueBright',
    muted: 'gray',
    text: 'whiteBright',
    textDim: 'yellow',
    border: 'yellow',
    borderGlow: 'yellowBright',
    headerGlow: 'yellow',
    inputPrompt: 'blueBright',
    userMessage: 'cyanBright',
    assistantMessage: 'yellowBright',
    codeBlock: 'blueBright',
    highlight: 'redBright',
  },

  // Ghost theme - monochrome with cyan accents
  ghost: {
    primary: 'whiteBright',
    secondary: 'cyanBright',
    accent: 'cyan',
    success: 'greenBright',
    warning: 'yellow',
    error: 'redBright',
    info: 'cyanBright',
    muted: 'gray',
    text: 'whiteBright',
    textDim: 'gray',
    border: 'gray',
    borderGlow: 'whiteBright',
    headerGlow: 'cyanBright',
    inputPrompt: 'cyanBright',
    userMessage: 'whiteBright',
    assistantMessage: 'cyanBright',
    codeBlock: 'gray',
    highlight: 'cyan',
  },

  // Inferno theme - red and orange
  inferno: {
    primary: 'redBright',
    secondary: 'yellow',
    accent: 'yellowBright',
    success: 'greenBright',
    warning: 'yellow',
    error: 'redBright',
    info: 'yellow',
    muted: 'gray',
    text: 'whiteBright',
    textDim: 'red',
    border: 'red',
    borderGlow: 'redBright',
    headerGlow: 'redBright',
    inputPrompt: 'yellowBright',
    userMessage: 'yellowBright',
    assistantMessage: 'redBright',
    codeBlock: 'yellow',
    highlight: 'yellowBright',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ASCII ART BORDERS AND DECORATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const CyberBorders = {
  // Double-line cyberpunk box
  double: {
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    horizontal: '═',
    vertical: '║',
    teeLeft: '╠',
    teeRight: '╣',
    teeUp: '╩',
    teeDown: '╦',
    cross: '╬',
  },

  // Single-line tech box
  single: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
    teeLeft: '├',
    teeRight: '┤',
    teeUp: '┴',
    teeDown: '┬',
    cross: '┼',
  },

  // Heavy/bold box
  heavy: {
    topLeft: '┏',
    topRight: '┓',
    bottomLeft: '┗',
    bottomRight: '┛',
    horizontal: '━',
    vertical: '┃',
    teeLeft: '┣',
    teeRight: '┫',
    teeUp: '┻',
    teeDown: '┳',
    cross: '╋',
  },

  // Rounded corners
  rounded: {
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    horizontal: '─',
    vertical: '│',
    teeLeft: '├',
    teeRight: '┤',
    teeUp: '┴',
    teeDown: '┬',
    cross: '┼',
  },

  // Dot pattern
  dots: {
    topLeft: '·',
    topRight: '·',
    bottomLeft: '·',
    bottomRight: '·',
    horizontal: '·',
    vertical: '·',
    teeLeft: '·',
    teeRight: '·',
    teeUp: '·',
    teeDown: '·',
    cross: '·',
  },

  // Block pattern
  blocks: {
    topLeft: '▛',
    topRight: '▜',
    bottomLeft: '▙',
    bottomRight: '▟',
    horizontal: '▀',
    vertical: '▌',
    teeLeft: '▌',
    teeRight: '▐',
    teeUp: '▄',
    teeDown: '▀',
    cross: '█',
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// DECORATIVE ELEMENTS
// ═══════════════════════════════════════════════════════════════════════════════

export const CyberSymbols = {
  // Status indicators
  online: '●',
  offline: '○',
  loading: '◐',
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',

  // Arrows and pointers
  arrowRight: '▶',
  arrowLeft: '◀',
  arrowUp: '▲',
  arrowDown: '▼',
  chevronRight: '›',
  chevronLeft: '‹',
  pointer: '❯',
  cursor: '█',
  cursorBlink: '▌',

  // Tech symbols
  circuit: '⊡',
  node: '◉',
  data: '◈',
  signal: '◆',
  wave: '∿',
  pulse: '⏦',
  core: '⬡',
  chip: '⬢',

  // Decorative
  star: '★',
  spark: '✦',
  bolt: '⚡',
  diamond: '◇',
  hex: '⎔',
  gear: '⚙',
  power: '⏻',
  infinity: '∞',

  // Block shades for gradients
  shadeLight: '░',
  shadeMedium: '▒',
  shadeDark: '▓',
  shadeBlock: '█',

  // Line elements
  lineThin: '─',
  lineThick: '━',
  lineDotted: '┄',
  lineDashed: '┅',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SPINNER FRAMES
// ═══════════════════════════════════════════════════════════════════════════════

export const CyberSpinners = {
  // Cyber dots
  cyberDots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],

  // Electric pulse
  pulse: ['◐', '◓', '◑', '◒'],

  // Circuit loading
  circuit: ['⊡', '⊞', '⊟', '⊠'],

  // Neon bars
  neonBars: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', '▇', '▆', '▅', '▄', '▃', '▂'],

  // Binary
  binary: ['0', '1'],

  // Matrix
  matrix: ['░', '▒', '▓', '█', '▓', '▒'],

  // Tech orbit
  orbit: ['◜', '◠', '◝', '◞', '◡', '◟'],

  // Power up
  powerUp: ['⏻', '⏼', '⏽', '⭘', '⏽', '⏼'],

  // Hexagon
  hexagon: ['⬡', '⬢', '⬡', '⬢'],

  // Electric
  electric: ['⚡', '⚡', '✦', '✦', '★', '★', '✦', '✦'],

  // Data stream
  dataStream: ['◈', '◇', '◈', '◆', '◈', '◇', '◈', '◆'],
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS BAR STYLES
// ═══════════════════════════════════════════════════════════════════════════════

export const CyberProgressStyles = {
  // Electric bar
  electric: {
    filled: '█',
    empty: '░',
    head: '▓',
    left: '[',
    right: ']',
  },

  // Neon line
  neon: {
    filled: '━',
    empty: '─',
    head: '●',
    left: '╺',
    right: '╸',
  },

  // Block gradient
  gradient: {
    filled: '▓',
    empty: '░',
    head: '█',
    left: '▐',
    right: '▌',
  },

  // Minimal
  minimal: {
    filled: '●',
    empty: '○',
    head: '◉',
    left: '',
    right: '',
  },

  // Tech
  tech: {
    filled: '▰',
    empty: '▱',
    head: '▰',
    left: '⟨',
    right: '⟩',
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// GLITCH CHARACTERS FOR EFFECTS
// ═══════════════════════════════════════════════════════════════════════════════

export const GlitchChars = {
  top: ['̈́', '̈', '̀', '́', '̂', '̌', '̃', '̆', '̇', '̊'],
  middle: ['̴', '̵', '̶', '̷', '̸'],
  bottom: ['̣', '̤', '̥', '̦', '̧', '̨', '̩', '̪', '̫', '̬'],
  zalgo: ['̍', '̎', '̐', '̒', '̓', '̔', '̽', '̾', '͆', '͊'],
  substitutes: ['#', '@', '$', '%', '&', '!', '?', '*', '~', '^'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a horizontal line with optional decorations
 */
export function createLine(
  width: number,
  char: string = '─',
  startChar?: string,
  endChar?: string
): string {
  const line = char.repeat(Math.max(0, width - (startChar ? 1 : 0) - (endChar ? 1 : 0)));
  return `${startChar || ''}${line}${endChar || ''}`;
}

/**
 * Create a decorated header line
 */
export function createHeader(
  text: string,
  width: number,
  border = CyberBorders.double
): string {
  const textLen = text.length + 2; // +2 for padding
  const leftPad = Math.floor((width - textLen) / 2);
  const rightPad = width - textLen - leftPad;

  return (
    border.horizontal.repeat(leftPad) +
    ` ${text} ` +
    border.horizontal.repeat(rightPad)
  );
}

/**
 * Wrap text in a box
 */
export function createBox(
  lines: string[],
  width: number,
  border = CyberBorders.double
): string[] {
  const result: string[] = [];
  const innerWidth = width - 2;

  // Top border
  result.push(
    border.topLeft +
    border.horizontal.repeat(innerWidth) +
    border.topRight
  );

  // Content lines
  for (const line of lines) {
    const paddedLine = line.padEnd(innerWidth).slice(0, innerWidth);
    result.push(border.vertical + paddedLine + border.vertical);
  }

  // Bottom border
  result.push(
    border.bottomLeft +
    border.horizontal.repeat(innerWidth) +
    border.bottomRight
  );

  return result;
}

/**
 * Create a gradient effect using block characters
 */
export function createGradient(width: number, reverse = false): string {
  const chars = ['░', '▒', '▓', '█'];
  const segmentWidth = Math.ceil(width / chars.length);
  let result = '';

  for (let i = 0; i < chars.length; i++) {
    const char = reverse ? chars[chars.length - 1 - i] : chars[i];
    result += char.repeat(segmentWidth);
  }

  return result.slice(0, width);
}

/**
 * Apply glitch effect to text (returns original text + zalgo chars)
 */
export function glitchText(text: string, intensity: number = 1): string {
  if (intensity === 0) return text;

  return text
    .split('')
    .map(char => {
      if (char === ' ' || Math.random() > intensity * 0.3) return char;

      const topGlitch = GlitchChars.top[Math.floor(Math.random() * GlitchChars.top.length)];
      const bottomGlitch = GlitchChars.bottom[Math.floor(Math.random() * GlitchChars.bottom.length)];

      if (Math.random() < intensity * 0.1) {
        return GlitchChars.substitutes[Math.floor(Math.random() * GlitchChars.substitutes.length)];
      }

      return char + topGlitch + bottomGlitch;
    })
    .join('');
}

/**
 * Create scanline effect (alternating dim lines)
 */
export function createScanlines(lines: string[]): string[] {
  return lines.map((line, i) => (i % 2 === 0 ? line : `\x1b[2m${line}\x1b[0m`));
}

/**
 * Get theme by name (with fallback)
 */
export function getTheme(themeName: string): CyberThemeColors {
  return CyberThemes[themeName] || CyberThemes.neon;
}

/**
 * Get all available theme names
 */
export function getThemeNames(): string[] {
  return Object.keys(CyberThemes);
}

export type BorderStyle = keyof typeof CyberBorders;
export type SpinnerStyle = keyof typeof CyberSpinners;
export type ProgressStyle = keyof typeof CyberProgressStyles;
export type ThemeName = keyof typeof CyberThemes;
