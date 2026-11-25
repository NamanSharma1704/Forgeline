'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sweep, type SweepItem } from '@/engine';
import { qtyIn, statusIn, toEngineArsenal } from '@/store/arsenal';
import { arsenalActions, useArsenal } from '@/store/useArsenal';
import { useRecipeGraph } from '@/store/useRecipeGraph';
import { Icon } from './Icon';
import { ArsenalTile, type TileWeapon } from './parts/ArsenalTile';
import { useScreenActions } from './shell/actions';

/**
 * The slot sweep (spec 5.5) as the game's inventory sell screen (design plan 8): every weapon the
 * player holds, sorted by the engine into Safe to sell, Keep and Protected favourites, each a tile
 * with its one-line reason. Above them, the inventory bar: how many slots can be freed, and the
 * split as one segmented meter.
 *
 * Mark sold is one click (or S on the focused tile), with no confirmation, because it can be undone:
 * for ten seconds the action bar offers Undo (U), which puts back the weapon's status and copies.
 * Favourites cannot be sold from here. Runs entirely in the browser over the stored arsenal.
 */

const UNDO_FOR = 10_000;

interface Sold {
  readonly slug: string;
  readonly name: string;
  readonly status: 'owned' | 'mastered';
  readonly qty: number;
}

export function SlotSweep() {
  const { ready, arsenal } = useArsenal();
  const entries = toEngineArsenal(arsenal);
  const heldCount = Object.values(entries).filter(
    (entry) => entry && (entry.status === 'owned' || entry.status === 'mastered')
  ).length;
  const { graph, slots, ranks, status } = useRecipeGraph(ready && heldCount > 0);
  const result = useMemo(() => (graph ? sweep(graph, entries) : null), [graph, entries]);

  const [sold, setSold] = useState<Sold | null>(null);
  const [said, setSaid] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const list = useRef<HTMLDivElement>(null);

  const sell = useCallback(
    (slug: string, name: string) => {
      const before = statusIn(arsenal, slug);
      if (before !== 'owned' && before !== 'mastered') return;
      const qty = qtyIn(arsenal, slug);
      // Focus moves to the next sellable tile, since this one leaves the grid.
      const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>('[data-sell]') ?? [])];
      const next = buttons[buttons.findIndex((button) => button.dataset.sell === slug) + 1];
      arsenalActions.setStatus(slug, 'sold');
      setSold({ slug, name, status: before, qty });
      setSaid(`Marked ${name} sold. Undo with U.`);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setSold(null), UNDO_FOR);
      requestAnimationFrame(() => (next ?? list.current?.querySelector<HTMLElement>('h2'))?.focus());
    },
    [arsenal]
  );

  const undo = useCallback(() => {
    if (!sold) return;
    arsenalActions.setStatus(sold.slug, sold.status);
    if (sold.qty > 1) arsenalActions.setQty(sold.slug, sold.qty);
    setSaid(`${sold.name} is back.`);
    setSold(null);
    if (timer.current) clearTimeout(timer.current);
  }, [sold]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // S sells the focused tile; U undoes the last sale, offered in the action bar while it can be.
  useScreenActions('sweep', [
    {
      id: 'sell',
      keyName: 's',
      label: 'Mark the focused weapon sold',
      keyOnly: true,
      run: () => {
        const button = document.activeElement?.closest('.sweep-card')?.querySelector<HTMLButtonElement>('[data-sell]');
        button?.click();
      },
    },
    ...(sold
      ? [{ id: 'undo', keyName: 'u', icon: 'back' as const, label: `Undo: ${sold.name}`, primary: true, run: undo }]
      : []),
  ]);

  const announcer = (
    <p className="sr-only" role="status" aria-live="polite">
      {said}
    </p>
  );

  if (!ready) return <p className="result-count">Reading your arsenal…</p>;

  if (heldCount === 0) {
    return (
      <>
        {announcer}
        <div className="empty panel">
          <p>
            Nothing to sort yet. Mark the weapons in your inventory as Owned or Mastered, and this page
            splits them into what you can sell and what you should keep.
          </p>
          <Link href="/arsenal/" className="button">
            Open My Arsenal
          </Link>
        </div>
      </>
    );
  }
  if (status === 'error') {
    return <p className="result-count">Could not load the recipe data. Reload to try again.</p>;
  }
  if (!graph || !slots || !ranks || !result) return <p className="result-count">Sorting your weapons…</p>;

  // graph.json carries names, slots and ranks; picture paths follow from the slug.
  const tile = (slug: string): TileWeapon => ({
    slug,
    name: graph.get(slug).name,
    slot: slots.get(slug) ?? 'primary',
    thumb: `img/thumb/${slug}.webp`,
    image: `img/${slug}.webp`,
    mr: ranks.get(slug) ?? 0,
  });

  const card = (item: SweepItem, kind: 'safe' | 'keep' | 'favourite') => {
    const weapon = tile(item.slug);
    return (
      <li key={item.slug} className="sweep-card" data-tone={kind}>
        <ArsenalTile
          weapon={weapon}
          href={`/w/${item.slug}/`}
          status={item.status}
          favourite={kind === 'favourite'}
          count={qtyIn(arsenal, item.slug)}
        />
        <p className="sweep-card__reason">{item.reason}</p>
        {kind === 'safe' && (
          <button
            type="button"
            className="sweep-card__sell"
            data-sell={item.slug}
            aria-keyshortcuts="S"
            onClick={() => sell(item.slug, weapon.name)}
          >
            <Icon name="sell" size={16} />
            Mark sold
            <span className="sr-only">: {weapon.name}</span>
            <kbd className="keycap" aria-hidden="true">
              S
            </kbd>
          </button>
        )}
        {kind === 'favourite' && (
          <p className="sweep-card__lock">
            <Icon name="star" size={14} />
            Protected
          </p>
        )}
      </li>
    );
  };

  const total = result.safe.length + result.keep.length + result.favourites.length;
  const sections: { kind: 'safe' | 'keep' | 'favourite'; title: string; icon: 'safe' | 'keep' | 'star'; items: readonly SweepItem[]; empty: string }[] = [
    {
      kind: 'safe',
      title: 'Safe to sell',
      icon: 'safe',
      items: result.safe,
      empty: 'Nothing yet. A weapon lands here once it is mastered and nothing unbuilt still needs it.',
    },
    { kind: 'keep', title: 'Keep', icon: 'keep', items: result.keep, empty: 'Nothing you hold needs keeping.' },
    {
      kind: 'favourite',
      title: 'Protected favourites',
      icon: 'star',
      items: result.favourites,
      empty:
        'None marked. Star a weapon you have put a Catalyst or Forma into, on its page or in My Arsenal, and the sweep will never suggest selling it.',
    },
  ];

  return (
    <div ref={list}>
      {announcer}
      <section className="inventory-bar" aria-label="Your inventory">
        <p className="inventory-bar__readout">
          <strong>{result.safe.length}</strong> {result.safe.length === 1 ? 'weapon slot' : 'weapon slots'} freeable
          <span className="inventory-bar__held">of {heldCount} held</span>
        </p>
        <div
          className="inventory-bar__meter"
          role="img"
          aria-label={`${result.safe.length} safe to sell, ${result.keep.length} to keep, ${result.favourites.length} favourites`}
        >
          {sections.map(
            ({ kind, items }) => items.length > 0 && <span key={kind} data-tone={kind} style={{ flexGrow: items.length / total }} />
          )}
        </div>
        <ul className="inventory-bar__legend">
          {sections.map(({ kind, title, items }) => (
            <li key={kind} data-tone={kind}>
              {title} <strong>{items.length}</strong>
            </li>
          ))}
        </ul>
      </section>

      {sections.map(({ kind, title, icon, items, empty }) => (
        <section key={kind} className="section sweep" data-tone={kind} aria-labelledby={`sweep-${kind}`}>
          <h2 id={`sweep-${kind}`} className="section-title sweep__title" tabIndex={-1}>
            <Icon name={icon} />
            {title} <span className="sweep__count">{items.length}</span>
          </h2>
          {items.length === 0 ? (
            <p className="muted">{empty}</p>
          ) : (
            <ul className="sweep-grid">{items.map((item) => card(item, kind))}</ul>
          )}
        </section>
      ))}
    </div>
  );
}
