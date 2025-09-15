/**
 * Custom implementations to replace vulnerable dependencies
 * This file provides safe alternatives to indent-string and shell-quote
 */

// Export our custom indent-string implementation
export { indentString as default } from './indent-string';
export { indentString } from './indent-string';

// Export our custom shell-quote implementation
export { quote, parse } from './shell-quote';
export { default as shellQuote } from './shell-quote';
