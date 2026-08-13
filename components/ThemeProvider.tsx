'use client';

/* ==========================================================
   THEME — defaults to the visitor's local time of day (their
   device clock — no geolocation needed), dark in the evening/
   night and light during the day. A manual toggle always wins
   after that and is remembered in localStorage.
   The blocking script in app/layout.tsx <head> mirrors this
   same time-based rule so there's no flash of the wrong theme
   before this provider mounts.
   ========================================================== */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'site-theme';

function timeBasedTheme(hour: number): Theme {
  return hour >= 7 && hour < 19 ? 'light' : 'dark';
}

function getPreferredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* storage unavailable */
  }
  return timeBasedTheme(new Date().getHours());
}

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Matches the value the blocking inline script already painted onto
  // <html data-theme> before hydration, so there's no mismatch.
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const current = (document.documentElement.dataset.theme as Theme) || getPreferredTheme();
    setTheme(current);
  }, []);

  const applyTheme = useCallback((next: Theme) => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
    setTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    applyTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, applyTheme]);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

/** Source for the blocking <head> script — inlined directly in layout.tsx
 *  (kept here so both places can't drift out of sync). Runs before React
 *  hydrates, setting data-theme immediately to prevent a flash. */
export const THEME_BLOCKING_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var hour = new Date().getHours();
    var theme = (stored === 'light' || stored === 'dark') ? stored : ((hour >= 7 && hour < 19) ? 'light' : 'dark');
    document.documentElement.dataset.theme = theme;
  } catch (e) { document.documentElement.dataset.theme = 'dark'; }
})();
`;
