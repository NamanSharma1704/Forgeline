'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { sweep, type SweepItem } from '@/engine';
import { toEngineArsenal } from '@/store/arsenal';
import { arsenalActions, useArsenal } from '@/store/useArsenal';
import { useRecipeGraph } from '@/store/useRecipeGraph';
import { Icon } from './Icon';
import { WeaponArt } from './WeaponArt';

/**
 * The slot-clearing sweep (spec 5.5): every weapon the player holds, sorted into what can go and
 * what must stay, each with its reason. Runs entirely in the browser over the stored arsenal.
 */
export function SlotSweep() {
  const { ready, arsenal } = useArsenal();
  const entries = toEngineArsenal(arsenal);
  const heldCount = Object.values(entries).filter(
    (entry) => entry && (entry.status === 'owned' || entry.status === 'mastered')
  ).length;
  const { graph, slots, status } = useRecipeGraph(ready && heldCount > 0);
  const result = useMemo(() => (graph ? sweep(graph, entries) : null), [graph, entries]);

  if (!ready) return <p className="result-count">Reading your arsenal…</p>;

  if (heldCount === 0) {
    return (
      <div className="empty panel">
        <p>
          Nothing to sort yet. Mark the weapons in your inventory as Owned or Mastered, and this page
          splits them into what you can sell and what you should keep.
        </p>
        <Link href="/arsenal/" className="button">
          Open My Arsenal
        </Link>
      </div>
    );
  }
  if (status === 'error') {
    return <p className="result-count">Could not load the recipe data. Reload to try again.</p>;
  }
  if (!graph || !slots || !result) return <p className="result-count">Sorting your weapons…</p>;

  // graph.json carries names and slots; picture paths follow from the slug.
  const art = (slug: string) => ({
    name: graph.get(slug).name,
    slot: slots.get(slug) ?? 'primary',
    thumb: `img/thumb/${slug}.webp`,
    image: `img/${slug}.webp`,
  });

  const row = (item: SweepItem, canSell: boolean) => (
    <li key={item.slug} className="sweep-row">
      <Link href={`/w/${item.slug}/`} className="sweep-row__weapon">
        <WeaponArt weapon={art(item.slug)} />
        <span className="sweep-row__name">{graph.get(item.slug).name}</span>
      </Link>
      <span className="sweep-row__reason">{item.reason}</span>
      {canSell && (
        <button type="button" className="button button--small" onClick={() => arsenalActions.setStatus(item.slug, 'sold')}>
          Mark sold
        </button>
      )}
    </li>
  );

  return (
    <>
      <p className="lede">
        You hold {heldCount} {heldCount === 1 ? 'weapon' : 'weapons'}.{' '}
        {result.safe.length === 0
          ? 'None of them can go yet.'
          : `${result.safe.length} can go.`}
      </p>

      <section className="section sweep sweep--safe" aria-labelledby="sweep-safe">
        <h2 id="sweep-safe" className="section-title sweep__title">
          <Icon name="safe" />
          Safe to sell <span className="sweep__count">{result.safe.length}</span>
        </h2>
        {result.safe.length === 0 ? (
          <p className="muted">
            Nothing yet. A weapon lands here once it is mastered and nothing unbuilt still needs it.
          </p>
        ) : (
          <ul className="sweep__list">{result.safe.map((item) => row(item, true))}</ul>
        )}
      </section>

      <section className="section sweep sweep--keep" aria-labelledby="sweep-keep">
        <h2 id="sweep-keep" className="section-title sweep__title">
          <Icon name="keep" />
          Keep <span className="sweep__count">{result.keep.length}</span>
        </h2>
        {result.keep.length === 0 ? (
          <p className="muted">Nothing you hold needs keeping.</p>
        ) : (
          <ul className="sweep__list">{result.keep.map((item) => row(item, false))}</ul>
        )}
      </section>
    </>
  );
}
