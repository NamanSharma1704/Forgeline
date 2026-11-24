'use client';

import { favouriteIn, statusIn } from '@/store/arsenal';
import { arsenalActions, useArsenal } from '@/store/useArsenal';
import { Icon } from './Icon';

/**
 * Mark a held weapon as a favourite: one the player has put a Catalyst, Forma or an Exilus Adapter
 * into. The slot sweep never suggests selling a favourite. Only shown while the weapon is held,
 * like the copies stepper, because a favourite you no longer hold means nothing.
 *
 * `compact` drops the word for tight rows; the label then carries it for screen readers.
 */
export function FavouriteToggle({
  slug,
  name,
  compact = false,
}: {
  slug: string;
  name: string;
  compact?: boolean;
}) {
  const { ready, arsenal } = useArsenal();
  if (!ready) return null;
  const status = statusIn(arsenal, slug);
  if (status !== 'owned' && status !== 'mastered') return null;
  const on = favouriteIn(arsenal, slug);

  return (
    <button
      type="button"
      className={compact ? 'favourite favourite--compact' : 'favourite'}
      aria-pressed={on}
      aria-label={compact ? `Favourite ${name}` : undefined}
      title={on ? 'Favourite: the sweep never suggests selling it' : 'Mark as a favourite'}
      onClick={() => arsenalActions.setFavourite(slug, !on)}
    >
      <Icon name="star" size={18} />
      {!compact && <span>Favourite</span>}
    </button>
  );
}
