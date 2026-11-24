'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icon';

/**
 * Spec 5.1: a "Copy result" button for pasting into clan chat. The text is plain ASCII (see
 * explain.ts), so it survives in-game chat. Falls back to a hidden textarea where the Clipboard API
 * is unavailable, and if both fail, shows the text so it can be selected by hand.
 */

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

type State = 'idle' | 'copied' | 'failed';

export function CopyResult({ text }: { text: string }) {
  const [state, setState] = useState<State>('idle');

  useEffect(() => {
    if (state !== 'copied') return;
    const timer = setTimeout(() => setState('idle'), 2400);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = async () => {
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
  };

  return (
    <div className="copy-result">
      <button type="button" className="button" onClick={copy}>
        <Icon name={state === 'copied' ? 'done' : 'copy'} size={20} />
        {state === 'copied' ? 'Copied' : 'Copy result'}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === 'copied' ? 'Result copied. Paste it into clan chat.' : ''}
      </span>
      {state === 'failed' && (
        <p className="copy-result__fallback">
          Copying is blocked here. Select this instead:
          <output className="copy-result__text">{text}</output>
        </p>
      )}
    </div>
  );
}
