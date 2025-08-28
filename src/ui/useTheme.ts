import { useState, useEffect, useMemo } from 'react';
import { ConfigManager } from '../config/ConfigManager.js';

export function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Load initial theme from config
  useEffect(() => {
    const initializeTheme = async () => {
      const configManager = new ConfigManager();
      await configManager.loadConfig();
      const config = configManager.getConfig();
      setTheme(config.theme);
    };
    initializeTheme();
  }, []);

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

  const updateTheme = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    const configManager = new ConfigManager();
    configManager.setConfig('theme', newTheme);
  };

  return {
    theme,
    setTheme: updateTheme,
    themeColors,
  };
}
