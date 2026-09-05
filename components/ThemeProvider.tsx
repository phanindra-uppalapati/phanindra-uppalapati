'use client';

/* ==========================================================
   THEME — defaults to dark for every first-time visitor
   (previously time-based: light 7am-7pm, dark otherwise — moved
   away from that so the site has one consistent, intentional
   default look rather than changing based on when someone happens
   to load it). A manual toggle always wins after that and is
   remembered in localStorage.
   The blocking script in app/layout.tsx <head> mirrors this same
   default so there's no flash of the wrong theme before this
   provider mounts.
   ========================================================== */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'site-theme';
const DEFAULT_THEME: Theme = 'dark';

function getPreferredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_THEME;
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
    // Reading document/localStorage can only happen after mount (both are
    // unavailable during SSR, which is why `theme` above defaults to a
    // fixed 'dark' rather than computing this eagerly) — there's no
    // external store to subscribe to here (useSyncExternalStore doesn't
    // fit: this is a one-time read-and-sync, not an ongoing subscription;
    // theme changes afterward flow through applyTheme's own setTheme call
    // below, not through this effect).
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    var theme = (stored === 'light' || stored === 'dark') ? stored : '${DEFAULT_THEME}';
    document.documentElement.dataset.theme = theme;
  } catch (e) { document.documentElement.dataset.theme = '${DEFAULT_THEME}'; }
})();
`;
