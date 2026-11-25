import Link from 'next/link';
import type { OwnershipStatus } from '@/data/types';
import { Icon } from '../Icon';
import { WeaponArt, type ArtSize, type ArtWeapon } from '../WeaponArt';

/**
 * The Arsenal tile (design plan 11.1): the one way a weapon is shown in a grid, on every screen.
 * A dark chamfered tile, the art centred, a translucent nameplate along the bottom with the name in
 * capitals, the mastery rank top right, and the state marks top left: copies held, a cyan diamond
 * while owned, the laurel once mastered, the gold star for a favourite, New in its first month, Sold.
 *
 * The face is written in reading order (name, rank, marks) and the art is decorative, so a screen
 * reader hears "Bolto, mastery rank 7, 2 held, mastered" once, not the name twice.
 */

export type TileSize = 'large' | 'medium' | 'small';

export interface TileWeapon extends ArtWeapon {
  readonly slug: string;
  /** Mastery rank needed to build it. */
  readonly mr: number;
}

export interface TileState {
  readonly status?: OwnershipStatus | null;
  readonly favourite?: boolean;
  /** Copies held; shown from two. */
  readonly count?: number;
  readonly isNew?: boolean;
}

const ART: Record<TileSize, ArtSize> = { large: 'large', medium: 'medium', small: 'thumb' };
const MARK: Record<TileSize, number> = { large: 20, medium: 16, small: 14 };

export function TileFace({
  weapon,
  size = 'medium',
  status = null,
  favourite = false,
  count = 0,
  isNew = false,
}: { weapon: TileWeapon; size?: TileSize } & TileState) {
  return (
    <>
      <span className="tile__nameplate">{weapon.name}</span>
      <span className="tile__mr">
        <span className="sr-only">, mastery rank </span>
        <span aria-hidden="true">MR </span>
        {weapon.mr}
      </span>
      <span className="tile__marks">
        {count > 1 && (
          <span className="tile__count">
            <span aria-hidden="true">×{count}</span>
            <span className="sr-only">, {count} held</span>
          </span>
        )}
        {status === 'owned' && (
          <span className="tile__owned">
            <span className="tile__owned-mark" aria-hidden="true" />
            <span className="sr-only">, owned</span>
          </span>
        )}
        {status === 'mastered' && (
          <span className="tile__laurel">
            <Icon name="laurel" size={MARK[size]} />
            <span className="sr-only">, mastered</span>
          </span>
        )}
        {favourite && (
          <span className="tile__star">
            <Icon name="star" size={MARK[size] - 2} />
            <span className="sr-only">, favourite</span>
          </span>
        )}
        {isNew && (
          <span className="tile__tag">
            <span className="sr-only">, </span>New
          </span>
        )}
        {status === 'sold' && (
          <span className="tile__tag tile__tag--sold">
            <span className="sr-only">, </span>Sold
          </span>
        )}
      </span>
      <span className="tile__art">
        <WeaponArt weapon={weapon} size={ART[size]} decorative />
      </span>
    </>
  );
}

/** The data attributes every tile carries, whatever element it is. */
export const tileAttributes = (size: TileSize, state: TileState) => ({
  'data-size': size,
  'data-status': state.status ?? undefined,
  'data-favourite': state.favourite ? '' : undefined,
});

/**
 * A tile that opens the weapon's page (`href`), or shows it in place. Grids that select before
 * opening use TileGrid, which draws the same face as options of a listbox.
 */
export function ArsenalTile({
  weapon,
  size = 'medium',
  href,
  selected = false,
  box,
  ...state
}: {
  weapon: TileWeapon;
  size?: TileSize;
  href?: string;
  selected?: boolean;
  /** An id for the family tree's wires to find this tile by. */
  box?: string;
} & TileState) {
  const face = <TileFace weapon={weapon} size={size} {...state} />;
  const attributes = {
    className: 'tile shape shape--frame',
    'data-selected': selected ? '' : undefined,
    'data-box': box,
    'data-slug': box ? weapon.slug : undefined,
    'aria-current': selected && href ? ('page' as const) : undefined,
    ...tileAttributes(size, state),
  };
  return href ? (
    <Link href={href} {...attributes}>
      {face}
    </Link>
  ) : (
    <div {...attributes}>{face}</div>
  );
}
