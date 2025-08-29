import { useState, useEffect, useMemo } from 'react';
import { ConfigManager } from '../../config/ConfigManager.js';

export type Theme = 'dark' | 'light';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark');

  // Load initial theme from config
  useEffect(() => {
    const loadTheme = async () => {
      const configManager = new ConfigManager();
      await configManager.loadConfig();
      const config = configManager.getConfig();
      setTheme(config.theme);
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    const configManager = new ConfigManager();
    configManager.setConfig('theme', newTheme);
  };

  // Theme colors
  const themeColors = useMemo(
    () => ({
      header: theme === 'dark' ? 'cyan' : 'blue',
      userMessage: theme === 'dark' ? 'green' : 'green',
      assistantMessage: theme === 'dark' ? 'blue' : 'magenta',
      inputPrompt: theme === 'dark' ? 'yellow' : 'black',
      footer: theme === 'dark' ? 'gray' : 'gray',
      error: 'red',
    }),
    [theme]
  );

  return {
    theme,
    setTheme,
    toggleTheme,
    themeColors,
  };
}
