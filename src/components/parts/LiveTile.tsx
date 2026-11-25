'use client';

import { isArsenalSetUp } from '@/engine';
import { favouriteIn, statusIn } from '@/store/arsenal';
import { useArsenal } from '@/store/useArsenal';
import { ArsenalTile, type TileSize, type TileWeapon } from './ArsenalTile';

/**
 * An Arsenal tile with the player's own marks on it (owned, mastered, sold, favourite, copies),
 * read from this browser. Pages are pre-rendered without them; they appear once the arsenal has
 * been read, and status marks only once it is set up, so a new player's tiles are not a wall of
 * guesses (spec 5.3).
 */
export function LiveTile({
  weapon,
  size = 'medium',
  href,
  selected = false,
  isNew = false,
  box,
}: {
  weapon: TileWeapon;
  size?: TileSize;
  href?: string;
  selected?: boolean;
  isNew?: boolean;
  box?: string;
}) {
  const { ready, arsenal } = useArsenal();
  const known = ready && isArsenalSetUp(arsenal.entries);
  return (
    <ArsenalTile
      weapon={weapon}
      size={size}
      href={href}
      selected={selected}
      isNew={isNew}
      box={box}
      status={known ? statusIn(arsenal, weapon.slug) : null}
      favourite={ready && favouriteIn(arsenal, weapon.slug)}
      count={ready ? arsenal.entries[weapon.slug]?.qty : undefined}
    />
  );
}
