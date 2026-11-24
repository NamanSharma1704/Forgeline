'use client';

import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { SLOT_LABEL, type Slot } from '@/data/types';
import { normalise } from '@/search/rank';
import { WeaponArt, type ArtWeapon } from './WeaponArt';

/**
 * Spec 5.7: every ingredient weapon with its slot, what it builds and the copy counts, sortable and
 * filterable. The "only ones I own" toggle arrives with the arsenal in phase 2.
 */

export interface IngredientRow extends ArtWeapon {
  readonly slug: string;
  readonly builds: readonly { slug: string; name: string; copies: number }[];
  /** Copies its recipes need in total, for sorting. */
  readonly totalCopies: number;
}

type SortKey = 'name' | 'slot' | 'copies';

const SLOT_ORDER: Slot[] = ['primary', 'secondary', 'melee', 'arch-gun', 'arch-melee', 'companion'];

export function IngredientIndex({ rows }: { rows: readonly IngredientRow[] }) {
  const id = useId();
  const [slot, setSlot] = useState<Slot | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('name');
  const [text, setText] = useState('');

  const slots = useMemo(
    () => SLOT_ORDER.filter((candidate) => rows.some((row) => row.slot === candidate)),
    [rows]
  );

  const visible = useMemo(() => {
    const needle = normalise(text);
    const filtered = rows.filter(
      (row) =>
        (slot === 'all' || row.slot === slot) &&
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
  }, [rows, slot, sort, text]);

  const reset = () => {
    setSlot('all');
    setText('');
  };

  return (
    <>
      <div className="filters">
        <div className="chips" role="group" aria-label="Filter by slot">
          <button
            type="button"
            className="chip"
            aria-pressed={slot === 'all'}
            onClick={() => setSlot('all')}
          >
            All
          </button>
          {slots.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className="chip"
              aria-pressed={slot === candidate}
              onClick={() => setSlot(candidate)}
            >
              {SLOT_LABEL[candidate]}
            </button>
          ))}
        </div>
        <label className="field" htmlFor={`${id}-text`}>
          Name
          <input
            id={`${id}-text`}
            type="text"
            value={text}
            placeholder="Weapon or what it builds"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <label className="field" htmlFor={`${id}-sort`}>
          Sort
          <select
            id={`${id}-sort`}
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
          >
            <option value="name">Name</option>
            <option value="slot">Slot</option>
            <option value="copies">Most copies needed</option>
          </select>
        </label>
      </div>

      <p className="result-count" role="status" aria-live="polite">
        {visible.length === rows.length
          ? `All ${rows.length} ingredient weapons`
          : `${visible.length} of ${rows.length} ingredient weapons`}
      </p>

      <div className="table-wrap shape">
        {visible.length === 0 ? (
          <div className="empty">
            <p>No ingredient weapon matches that. It may still exist and simply build nothing.</p>
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
    </>
  );
}
