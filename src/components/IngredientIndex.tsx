'use client';

import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { SLOT_LABEL, type Slot } from '@/data/types';
import { normalise } from '@/search/rank';
import { STATUS_LABEL, statusIn } from '@/store/arsenal';
import { useArsenal } from '@/store/useArsenal';
import { WeaponArt, type ArtWeapon } from './WeaponArt';

/**
 * Spec 5.7: every ingredient weapon with its slot, what it builds and the copy counts, sortable and
 * filterable, with a toggle for only the ones the player holds.
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
  const [mine, setMine] = useState(false);
  const { ready, arsenal } = useArsenal();
  const holds = (slug: string) => {
    const status = statusIn(arsenal, slug);
    return status === 'owned' || status === 'mastered';
  };

  const slots = useMemo(
    () => SLOT_ORDER.filter((candidate) => rows.some((row) => row.slot === candidate)),
    [rows]
  );

  const visible = useMemo(() => {
    const needle = normalise(text);
    const filtered = rows.filter(
      (row) =>
        (slot === 'all' || row.slot === slot) &&
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
  }, [rows, slot, sort, text, mine, ready, arsenal]);

  const reset = () => {
    setSlot('all');
    setText('');
    setMine(false);
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
        <button
          type="button"
          className="chip"
          aria-pressed={mine}
          onClick={() => setMine((value) => !value)}
        >
          Only ones I own
        </button>
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
    </>
  );
}
