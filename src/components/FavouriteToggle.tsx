'use client';

import { favouriteIn, statusIn } from '@/store/arsenal';
import { arsenalActions, useArsenal } from '@/store/useArsenal';
import { Icon } from './Icon';
import { useScreenActions } from './shell/actions';

/**
 * Mark a held weapon as a favourite: one the player has put a Catalyst, Forma or an Exilus Adapter
 * into. The slot sweep never suggests selling a favourite. Only shown while the weapon is held,
 * like the copies stepper, because a favourite you no longer hold means nothing.
 *
 * `compact` drops the word for tight rows; the label then carries it for screen readers. With
 * `shortcut`, the F key toggles it too (design plan 4.4), shown as a key cap on the button.
 */
export function FavouriteToggle({
  slug,
  name,
  compact = false,
  shortcut = false,
}: {
  slug: string;
  name: string;
  compact?: boolean;
  shortcut?: boolean;
}) {
  const { ready, arsenal } = useArsenal();
  const status = ready ? statusIn(arsenal, slug) : null;
  const held = status === 'owned' || status === 'mastered';
  const on = ready && favouriteIn(arsenal, slug);
  useScreenActions(
    `favourite-${slug}`,
    shortcut && held
      ? [{ id: 'favourite', keyName: 'f', label: on ? 'Unmark favourite' : 'Mark as favourite', keyOnly: true, run: () => arsenalActions.setFavourite(slug, !on) }]
      : []
  );
  if (!held) return null;

  return (
    <button
      type="button"
      className={compact ? 'favourite favourite--compact' : 'favourite'}
      aria-pressed={on}
      aria-label={compact ? `Favourite ${name}` : undefined}
      aria-keyshortcuts={shortcut ? 'F' : undefined}
      title={on ? 'Favourite: the sweep never suggests selling it' : 'Mark as a favourite'}
      onClick={() => arsenalActions.setFavourite(slug, !on)}
    >
      <Icon name="star" size={18} />
      {!compact && <span>Favourite</span>}
      {shortcut && <kbd className="keycap">F</kbd>}
    </button>
  );
}
