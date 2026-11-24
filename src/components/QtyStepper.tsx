'use client';

import { MAX_QTY, qtyIn, statusIn } from '@/store/arsenal';
import { arsenalActions, useArsenal } from '@/store/useArsenal';
import { Icon } from './Icon';

/**
 * How many copies of an ingredient the player holds. Only shown while it is held, because "keep 3,
 * you have 1" is the number that makes a Keep actionable (docs/spec-review.md gap 4).
 */
export function QtyStepper({ slug, name }: { slug: string; name: string }) {
  const { ready, arsenal } = useArsenal();
  if (!ready) return null;
  const status = statusIn(arsenal, slug);
  if (status !== 'owned' && status !== 'mastered') return null;
  const qty = qtyIn(arsenal, slug);

  return (
    <div className="qty" role="group" aria-label={`Copies of ${name} you hold`}>
      <span className="qty__label">Copies</span>
      <button
        type="button"
        className="qty__button"
        aria-label={`One fewer ${name}`}
        disabled={qty <= 1}
        onClick={() => arsenalActions.setQty(slug, qty - 1)}
      >
        <Icon name="minus" size={16} />
      </button>
      <output className="qty__value" aria-live="polite">
        {qty}
      </output>
      <button
        type="button"
        className="qty__button"
        aria-label={`One more ${name}`}
        disabled={qty >= MAX_QTY}
        onClick={() => arsenalActions.setQty(slug, qty + 1)}
      >
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}
