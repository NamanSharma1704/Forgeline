'use client';

import { useEffect } from 'react';

/**
 * Spec 5.1: pressing "/" anywhere on the site jumps to the search box. Prefers the home page's
 * large search, falls back to the one in the header, and never steals a "/" typed into a field.
 */
export function SearchShortcut() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }
      const input =
        document.querySelector<HTMLInputElement>('[data-search-input="hero"]') ??
        document.querySelector<HTMLInputElement>('[data-search-input="compact"]');
      if (!input) return;
      event.preventDefault();
      input.focus();
      input.select();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  return null;
}
