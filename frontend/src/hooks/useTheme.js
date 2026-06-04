import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'campusflow-theme';

export function useTheme() {
  const [darkMode, setDarkModeState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
    } catch {
      /* ignore */
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem(STORAGE_KEY, darkMode ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }, [darkMode]);

  const setDarkMode = useCallback((value) => {
    setDarkModeState((prev) => (typeof value === 'function' ? value(prev) : value));
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkModeState((d) => !d);
  }, []);

  return { darkMode, setDarkMode, toggleDarkMode };
}
