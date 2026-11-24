'use client';

import { useRef } from 'react';
import type { OwnershipStatus } from '@/data/types';
import { STATUS_LABEL, STATUSES, statusIn } from '@/store/arsenal';
import { arsenalActions, useArsenal } from '@/store/useArsenal';

/**
 * One weapon's status (spec 5.4): Not owned, Owned, Mastered, Sold. A radio group, so one tap sets
 * it and the arrow keys move between options. Until the stored arsenal is read, nothing shows as
 * selected: better no answer than a wrong one.
 */
export function StatusPicker({
  slug,
  name,
  size = 'default',
}: {
  slug: string;
  name: string;
  size?: 'default' | 'small';
}) {
  const { ready, arsenal } = useArsenal();
  const current: OwnershipStatus | null = ready ? statusIn(arsenal, slug) : null;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const focusIndex = current ? STATUSES.indexOf(current) : 0;

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + STATUSES.length) % STATUSES.length;
    arsenalActions.setStatus(slug, STATUSES[next]!);
    buttons.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={`Your ${name}`} className={`status-picker status-picker--${size}`}>
      {STATUSES.map((status, index) => (
        <button
          key={status}
          ref={(element) => {
            buttons.current[index] = element;
          }}
          type="button"
          role="radio"
          aria-checked={current === status}
          tabIndex={index === focusIndex ? 0 : -1}
          className="status-picker__option"
          data-status={status}
          onClick={() => arsenalActions.setStatus(slug, status)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {STATUS_LABEL[status]}
        </button>
      ))}
    </div>
  );
}
