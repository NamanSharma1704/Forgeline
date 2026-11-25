'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Copy a line for clan chat (spec 5.1). The Clipboard API first, then a hidden textarea where the
 * API is unavailable; if both fail, the caller shows the text so it can be selected by hand.
 * "copied" falls back to "idle" after a moment, so the button reads as ready again.
 */

export type CopyState = 'idle' | 'copied' | 'failed';

function legacyCopy(text: string) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('copy command refused');
}

export function useCopyText(text: string) {
  const [state, setState] = useState<CopyState>('idle');

  useEffect(() => {
    if (state !== 'copied') return;
    const timer = setTimeout(() => setState('idle'), 2400);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else legacyCopy(text);
      setState('copied');
    } catch {
      try {
        legacyCopy(text);
        setState('copied');
      } catch {
        setState('failed');
      }
    }
  }, [text]);

  return { state, copy };
}
