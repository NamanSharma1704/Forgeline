'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import { favouriteIn, statusIn } from '@/store/arsenal';
import { useArsenal } from '@/store/useArsenal';
import { TileFace, tileAttributes, type TileWeapon } from './ArsenalTile';
import { InspectPanel } from './InspectPanel';

/**
 * A grid that selects, then inspects (design plan 2.2 and 11.6). A listbox of Arsenal tiles: one
 * click, or the arrow keys, select a tile and open the inspect panel beside the grid; a second
 * click on the selected tile, or Enter, opens its dossier. Home and End jump to the ends; Space
 * selects without moving. Only one tile is in the tab order at a time (a roving tab stop), so Tab
 * leaves the grid in one press. Closing the panel puts focus back on the tile it came from.
 */
export function TileGrid({
  weapons,
  label,
  catalogue = [],
  extra,
}: {
  weapons: readonly TileWeapon[];
  label: string;
  /** Tile data for other weapons the panel may show, such as what these build. */
  catalogue?: readonly TileWeapon[];
  /** More to show inside each tile, under its nameplate. Not interactive: the tile is one option. */
  extra?: (weapon: TileWeapon) => React.ReactNode;
}) {
  const router = useRouter();
  const { ready, arsenal } = useArsenal();
  const [selected, setSelected] = useState<string | null>(null);
  const [stop, setStop] = useState<string | null>(weapons[0]?.slug ?? null);
  const tiles = useRef(new Map<string, HTMLDivElement>());
  const current = useRef<string | null>(null);

  const select = (slug: string) => {
    current.current = slug;
    setSelected(slug);
    setStop(slug);
    tiles.current.get(slug)?.focus();
  };
  const open = (slug: string) => router.push(`/w/${slug}/`);
  // Back to the tile the panel came from, once the panel has gone.
  const close = useCallback(() => {
    const slug = current.current;
    current.current = null;
    setSelected(null);
    if (slug) requestAnimationFrame(() => tiles.current.get(slug)?.focus());
  }, []);

  // Columns as laid out now, for Up and Down: the tiles sharing the first tile's row.
  const columns = () => {
    const first = tiles.current.get(weapons[0]?.slug ?? '');
    if (!first) return 1;
    return Math.max(1, weapons.filter((w) => tiles.current.get(w.slug)?.offsetTop === first.offsetTop).length);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const index = weapons.findIndex((weapon) => weapon.slug === stop);
    if (index < 0) return;
    const last = weapons.length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = Math.min(last, index + 1);
        break;
      case 'ArrowLeft':
        next = Math.max(0, index - 1);
        break;
      case 'ArrowDown':
        next = Math.min(last, index + columns());
        break;
      case 'ArrowUp':
        next = Math.max(0, index - columns());
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      case 'Enter':
        event.preventDefault();
        open(weapons[index]!.slug);
        return;
      case ' ':
        event.preventDefault();
        select(weapons[index]!.slug);
        return;
      default:
        return;
    }
    event.preventDefault();
    select(weapons[next]!.slug);
  };

  const known = useMemo(
    () => new Map([...catalogue, ...weapons].map((weapon) => [weapon.slug, weapon] as const)),
    [catalogue, weapons]
  );
  const lookup = useCallback((slug: string) => known.get(slug), [known]);
  const inspected = selected ? lookup(selected) : undefined;

  return (
    <div className="inspect-layout" data-inspecting={inspected ? '' : undefined}>
      <div role="listbox" aria-label={label} className="tile-grid" onKeyDown={onKeyDown}>
        {weapons.map((weapon) => {
          const status = ready ? statusIn(arsenal, weapon.slug) : null;
          const state = {
            status,
            favourite: ready && favouriteIn(arsenal, weapon.slug),
            count: ready ? arsenal.entries[weapon.slug]?.qty : undefined,
          };
          return (
            <div
              key={weapon.slug}
              ref={(element) => {
                if (element) tiles.current.set(weapon.slug, element);
                else tiles.current.delete(weapon.slug);
              }}
              role="option"
              aria-selected={selected === weapon.slug}
              tabIndex={weapon.slug === stop ? 0 : -1}
              className="tile shape shape--frame"
              {...tileAttributes('medium', state)}
              onFocus={() => setStop(weapon.slug)}
              onClick={() => (selected === weapon.slug ? open(weapon.slug) : select(weapon.slug))}
            >
              <TileFace weapon={weapon} {...state} />
              {extra && <span className="tile__extra">{extra(weapon)}</span>}
            </div>
          );
        })}
      </div>
      {inspected && <InspectPanel weapon={inspected} onClose={close} find={lookup} />}
    </div>
  );
}
