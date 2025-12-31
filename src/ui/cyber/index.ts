/**
 * FOSSCODE CYBERPUNK UI FRAMEWORK
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * A stunning neon-drenched terminal UI framework for the next generation
 * of command-line applications.
 *
 * Features:
 * - Multiple cyberpunk color themes (Neon, Matrix, Synthwave, Blade Runner, etc.)
 * - Animated text effects (pulse, wave, glitch, typewriter, matrix)
 * - Beautiful ASCII art borders and decorations
 * - Advanced loading spinners and progress bars
 * - Responsive components for different terminal sizes
 *
 * Usage:
 * import { CyberHeader, CyberBox, CyberText, CyberThemes } from './cyber';
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// Theme system
export {
  CyberColors,
  CyberThemes,
  CyberBorders,
  CyberSymbols,
  CyberSpinners,
  CyberProgressStyles,
  GlitchChars,
  createLine,
  createHeader,
  createBox,
  createGradient,
  glitchText,
  createScanlines,
  getTheme,
  getThemeNames,
  type CyberThemeColors,
  type BorderStyle,
  type SpinnerStyle,
  type ProgressStyle,
  type ThemeName,
} from './CyberTheme.js';

// Box and container components
export {
  CyberBox,
  CyberDivider,
  CyberBadge,
  CyberStatus,
} from './CyberBox.js';

// Text components
export {
  CyberText,
  NeonTitle,
  CyberLabel,
  CyberLink,
  Highlight,
} from './CyberText.js';

// Header components
export {
  CyberHeader,
  CyberLogo,
  CyberBanner,
} from './CyberHeader.js';

// Spinner and loading components
export {
  CyberSpinner,
  CyberProgressBar,
  CyberLoadingScreen,
  CyberTypingDots,
  CyberPulse,
} from './CyberSpinner.js';

// Input components
export {
  CyberInput,
  CyberCommandLine,
  CyberPrompt,
  CyberSearchBox,
  CyberHintsBar,
} from './CyberInput.js';

// Footer and status components
export {
  CyberFooter,
  CyberStatusBar,
  CyberTokenBar,
  CyberNotification,
} from './CyberFooter.js';

// Message components
export {
  CyberMessage,
  CyberMessageList,
  CyberErrorMessage,
  CyberSuccessMessage,
  CyberWelcomeMessage,
  CyberThinkingBlock,
} from './CyberMessages.js';
