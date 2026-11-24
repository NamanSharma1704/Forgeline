'use client';

import { useLayoutEffect } from 'react';
import { Icon } from './Icon';
import { THEME_STORAGE_KEY } from './theme';

/**
 * Spec 5.10: dark by default, with a light option.
 *
 * Follows node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md: the
 * inline script in <head> (theme.ts) applies the saved theme before first paint, and this effect
 * re-applies it after React's development-mode remount resets <html>. Both icons render and CSS
 * shows the right one, so server and client markup always match and nothing flickers.
 */
export function ThemeToggle() {
  useLayoutEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
    } catch {
      // Storage can be blocked; the default theme still works.
    }
  }, []);

  const toggle = () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Not persisted, but the switch still applies for this visit.
    }
  };

  return (
    <button
      type="button"
      className="icon-button"
      onClick={toggle}
      aria-label="Switch between dark and light theme"
      title="Switch theme"
    >
      <Icon name="sun" className="when-dark" />
      <Icon name="moon" className="when-light" />
    </button>
  );
}
