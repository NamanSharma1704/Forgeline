'use client';

import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { SLOT_LABEL, type Slot } from '@/data/types';
import { VARIANT_LABEL, VARIANT_ORDER, type Variant } from '@/data/variants';
import { normalise } from '@/search/rank';
import { STATUS_LABEL, statusIn } from '@/store/arsenal';
import { useArsenal } from '@/store/useArsenal';
import { FilterSearch, FilterSelect, FilterToggle, SlotTabs } from './Filters';
import { Icon } from './Icon';
import type { TileWeapon } from './parts/ArsenalTile';
import { TileGrid } from './parts/TileGrid';
import { useScreenActions } from './shell/actions';
import { WeaponArt, type ArtWeapon } from './WeaponArt';

/**
 * Spec 5.7, as the component matrix (design plan 7): every ingredient weapon, sortable and
 * filterable, with a toggle for only the ones the player holds. The grid (the default) shows each
 * as an Arsenal tile with its demand under the nameplate and opens the inspect panel when one is
 * selected; the list is the table, for scanning. G and L switch between them.
 */

export interface IngredientRow extends ArtWeapon {
  readonly slug: string;
  /** Mastery rank needed to build it. */
  readonly mr: number;
  /** Made from other weapons as well as used in a later recipe. */
  readonly intermediate: boolean;
  readonly variant: Variant;
  readonly builds: readonly { slug: string; name: string; copies: number }[];
  /** Copies its recipes need in total, for sorting. */
  readonly totalCopies: number;
}

type SortKey = 'name' | 'slot' | 'copies';

const SORT_LABEL: Record<SortKey, string> = {
  name: 'Sort: Name',
  slot: 'Sort: Slot',
  copies: 'Sort: Most copies needed',
};

const SLOT_ORDER: Slot[] = ['primary', 'secondary', 'melee', 'arch-gun', 'arch-melee', 'companion'];

export function IngredientIndex({
  rows,
  catalogue,
}: {
  rows: readonly IngredientRow[];
  /** Tiles for the weapons these build, for the inspect panel. */
  catalogue: readonly TileWeapon[];
}) {
  const id = useId();
  const [slot, setSlot] = useState<Slot | 'all'>('all');
  const [variant, setVariant] = useState<Variant | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('name');
  const [text, setText] = useState('');
  const [mine, setMine] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  useScreenActions('ingredients-view', [
    { id: 'grid', keyName: 'g', label: 'Grid view', keyOnly: true, run: () => setView('grid') },
    { id: 'list', keyName: 'l', label: 'List view', keyOnly: true, run: () => setView('list') },
  ]);
  const { ready, arsenal } = useArsenal();
  const holds = (slug: string) => {
    const status = statusIn(arsenal, slug);
    return status === 'owned' || status === 'mastered';
  };

  const slots = useMemo(
    () => SLOT_ORDER.filter((candidate) => rows.some((row) => row.slot === candidate)),
    [rows]
  );

  const variants = useMemo(
    () =>
      VARIANT_ORDER.flatMap((candidate) => {
        const count = rows.filter((row) => row.variant === candidate).length;
        return count > 0 ? [{ variant: candidate, count }] : [];
      }),
    [rows]
  );

  const visible = useMemo(() => {
    const needle = normalise(text);
    const filtered = rows.filter(
      (row) =>
        (slot === 'all' || row.slot === slot) &&
        (variant === 'all' || row.variant === variant) &&
        (!mine || (ready && holds(row.slug))) &&
        (!needle ||
          normalise(row.name).includes(needle) ||
          row.builds.some((b) => normalise(b.name).includes(needle)))
    );
    const byName = (a: IngredientRow, b: IngredientRow) => a.name.localeCompare(b.name, 'en');
    return [...filtered].sort((a, b) => {
      if (sort === 'slot') {
        return SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) || byName(a, b);
      }
      if (sort === 'copies') return b.totalCopies - a.totalCopies || byName(a, b);
      return byName(a, b);
    });
    // `holds` reads the arsenal, so the arsenal is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, slot, variant, sort, text, mine, ready, arsenal]);

  const filtered = slot !== 'all' || variant !== 'all' || mine || text.trim() !== '';
  const visibleTiles = useMemo(() => visible.map((row): TileWeapon => ({ ...row })), [visible]);
  const byslug = useMemo(() => new Map(rows.map((row) => [row.slug, row])), [rows]);

  const reset = () => {
    setSlot('all');
    setVariant('all');
    setText('');
    setMine(false);
  };

  return (
    <>
      <div className="filter-bar index-filters">
        <FilterSearch
          id={`${id}-text`}
          label="Filter by weapon, or by what it builds"
          value={text}
          placeholder="Weapon or what it builds"
          onChange={setText}
        />
        <SlotTabs slots={slots} value={slot} onChange={setSlot} />
        {variants.length > 1 && (
          <FilterSelect
            id={`${id}-variant`}
            label="Variant"
            value={variant}
            active={variant !== 'all'}
            onChange={(value) => setVariant(value as Variant | 'all')}
          >
            <option value="all">Any variant</option>
            {variants.map(({ variant: candidate, count }) => (
              <option key={candidate} value={candidate}>
                {VARIANT_LABEL[candidate]} ({count})
              </option>
            ))}
          </FilterSelect>
        )}
        <FilterToggle pressed={mine} onToggle={() => setMine((value) => !value)}>
          Only ones I own
        </FilterToggle>
        <FilterSelect
          id={`${id}-sort`}
          label="Sort order"
          value={sort}
          className="filter-bar__sort"
          onChange={(value) => setSort(value as SortKey)}
        >
          {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
            <option key={key} value={key}>
              {SORT_LABEL[key]}
            </option>
          ))}
        </FilterSelect>
        <div className="view-toggle" role="group" aria-label="View">
          <button type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')} title="Grid" aria-keyshortcuts="G">
            <Icon name="grid" size={18} label="Grid" />
            <kbd className="keycap" aria-hidden="true">G</kbd>
          </button>
          <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')} title="List" aria-keyshortcuts="L">
            <Icon name="list" size={18} label="List" />
            <kbd className="keycap" aria-hidden="true">L</kbd>
          </button>
        </div>
      </div>

      <p className="result-count">
        <span role="status" aria-live="polite">
          {visible.length === rows.length
            ? `All ${rows.length} ingredient weapons`
            : `${visible.length} of ${rows.length} ingredient weapons`}
        </span>
        {filtered && visible.length > 0 && (
          <button type="button" className="link-button result-count__clear" onClick={reset}>
            Clear filters
          </button>
        )}
      </p>

      {visible.length > 0 && view === 'grid' ? (
        <TileGrid
          weapons={visibleTiles}
          catalogue={catalogue}
          label="Ingredient weapons"
          extra={(weapon) => {
            const row = byslug.get(weapon.slug)!;
            return (
              <span className="demand">
                <span className="demand__needed">
                  Needed <strong>×{row.totalCopies}</strong>
                </span>
                {row.intermediate && <span className="tile__tag">Intermediate</span>}
                <span className="demand__builds">Builds {row.builds.map((build) => build.name).join(', ')}</span>
              </span>
            );
          }}
        />
      ) : (
      <div className="table-wrap shape">
        {visible.length === 0 ? (
          <div className="empty">
            <p>
              {mine
                ? 'You have not marked any of these as owned or mastered yet. '
                : 'No ingredient weapon matches that. It may still exist and simply build nothing. '}
              {mine && <Link href="/arsenal/">Open My Arsenal</Link>}
            </p>
            <button type="button" className="button" onClick={reset}>
              Clear filters
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Weapon</th>
                <th scope="col" className="col-slot">
                  Slot
                </th>
                <th scope="col">Used to build</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.slug}>
                  <th scope="row">
                    <Link href={`/w/${row.slug}/`} className="cell-weapon">
                      <WeaponArt weapon={row} />
                      <span>
                        {row.name}
                        <span className="cell-weapon__slot">{SLOT_LABEL[row.slot]}</span>
                        {ready && statusIn(arsenal, row.slug) !== 'notOwned' && (
                          <span className="status-tag" data-status={statusIn(arsenal, row.slug)}>
                            {STATUS_LABEL[statusIn(arsenal, row.slug)]}
                          </span>
                        )}
                      </span>
                    </Link>
                  </th>
                  <td className="cell-muted col-slot">{SLOT_LABEL[row.slot]}</td>
                  <td>
                    <span className="builds">
                      {row.builds.map((build) => (
                        <span key={build.slug}>
                          <Link href={`/w/${build.slug}/`}>{build.name}</Link>{' '}
                          <span className="builds__copies">
                            {build.copies} {build.copies === 1 ? 'copy' : 'copies'}
                          </span>
                        </span>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      )}
    </>
  );
}
