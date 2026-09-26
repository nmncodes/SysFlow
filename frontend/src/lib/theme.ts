import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'sysflow-theme';

function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

function getPreferredTheme(): Theme {
  const stored = getStoredTheme();
  if (stored) return stored;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

// Every page/component that calls useTheme() gets its own useState, but they all need to agree
// on the current theme (e.g. toggling in the editor header should also repaint the minimap).
// A tiny module-level pub/sub keeps every hook instance in sync without lifting state up.
let currentTheme: Theme = getPreferredTheme();
const listeners = new Set<(theme: Theme) => void>();

function setGlobalTheme(next: Theme) {
  currentTheme = next;
  applyTheme(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore write failures (e.g. private browsing)
  }
  listeners.forEach((listener) => listener(next));
}

// Apply on module load too, in case the initial render happens before any hook mounts.
applyTheme(currentTheme);

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    const listener = (next: Theme) => setTheme(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const toggle = useCallback(() => {
    setGlobalTheme(currentTheme === 'dark' ? 'light' : 'dark');
  }, []);

  return { theme, toggle };
}
