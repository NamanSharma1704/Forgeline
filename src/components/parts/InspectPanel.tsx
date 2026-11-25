'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useSyncExternalStore } from 'react';
import { createEvaluator, explain, isArsenalSetUp, type Tone } from '@/engine';
import { favouriteIn, statusIn, toEngineArsenal } from '@/store/arsenal';
import { useArsenal } from '@/store/useArsenal';
import { useRecipeGraph } from '@/store/useRecipeGraph';
import { FavouriteToggle } from '../FavouriteToggle';
import { Icon, type IconName } from '../Icon';
import { useScreenActions } from '../shell/actions';
import { StatusPicker } from '../StatusPicker';
import { ArsenalTile, type TileWeapon } from './ArsenalTile';

/**
 * Select, then inspect (design plan 11.6): the panel that opens beside a grid when a tile is
 * selected. The weapon's large tile, its verdict and reason, its status and favourite, what it
 * builds, and the way into its full dossier, all without leaving the grid.
 *
 * On a wide screen it is a labelled region beside the grid, and Esc (through the action bar's
 * keys) closes it. On a phone it is a bottom sheet: a modal dialog, so focus stays inside and Esc
 * closes it natively. Either way the caller returns focus to the tile it came from.
 */

const PHONE = '(max-width: 759px)';
const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(PHONE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
const usePhone = () => useSyncExternalStore(subscribe, () => window.matchMedia(PHONE).matches, () => false);

const ICON: Record<Tone, IconName> = { safe: 'safe', 'safe-soft': 'safe', check: 'check', keep: 'keep' };

export function InspectPanel({
  weapon,
  onClose,
  find,
}: {
  weapon: TileWeapon;
  onClose: () => void;
  /** Tile data for the weapons it builds. */
  find: (slug: string) => TileWeapon | undefined;
}) {
  const phone = usePhone();
  const titleId = useId();
  const { ready, arsenal } = useArsenal();
  const entries = toEngineArsenal(arsenal);
  const personal = ready && isArsenalSetUp(entries);
  const { graph, status: graphStatus } = useRecipeGraph(true);

  const verdict = useMemo(() => {
    if (!graph || !graph.has(weapon.slug)) return null;
    return explain(createEvaluator(graph, personal ? entries : {}).verdict(weapon.slug), graph);
  }, [graph, weapon.slug, personal, entries]);

  const builds = graph?.has(weapon.slug)
    ? graph
        .get(weapon.slug)
        .usedToBuild.flatMap((edge) => {
          const target = find(edge.slug);
          return target ? [{ target, copies: edge.copies }] : [];
        })
    : [];

  useScreenActions('inspect', phone ? [] : [{ id: 'inspect-close', keyName: 'Escape', label: 'Close the inspect panel', keyOnly: true, run: onClose }]);

  const sheet = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (phone && sheet.current && !sheet.current.open) sheet.current.showModal();
  }, [phone]);

  const status = ready ? statusIn(arsenal, weapon.slug) : null;
  const body = (
    <>
      <div className="inspect__bar">
        <h2 id={titleId} className="inspect__title">
          <span className="sr-only">Inspecting </span>
          {weapon.name}
        </h2>
        <button type="button" className="icon-button inspect__close" onClick={onClose} aria-label="Close" aria-keyshortcuts="Escape">
          <Icon name="close" />
        </button>
      </div>

      <ArsenalTile
        weapon={weapon}
        size="large"
        status={status}
        favourite={ready && favouriteIn(arsenal, weapon.slug)}
        count={ready ? arsenal.entries[weapon.slug]?.qty : undefined}
      />

      {verdict ? (
        <div className="inspect__verdict" data-tone={verdict.tone}>
          <Icon name={ICON[verdict.tone]} size={22} />
          <p className="inspect__headline">{verdict.headline}</p>
          <p className="inspect__reason">{verdict.summary}</p>
        </div>
      ) : (
        <p className="inspect__reason">
          {graphStatus === 'error' ? 'Could not load the recipes. Reload to try again.' : 'Checking the recipes…'}
        </p>
      )}

      <div className="inspect__controls">
        <StatusPicker slug={weapon.slug} name={weapon.name} size="small" />
        <FavouriteToggle slug={weapon.slug} name={weapon.name} />
      </div>

      {builds.length > 0 && (
        <div>
          <h3 className="inspect__label">Used to build</h3>
          <ul className="inspect__builds">
            {builds.map(({ target, copies }) => (
              <li key={target.slug}>
                <ArsenalTile weapon={target} size="small" href={`/w/${target.slug}/`} />
                {/* Copies one build takes: a recipe fact, not a count held, so not the tile's own mark. */}
                <span className="inspect__copies">×{copies} per build</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link href={`/w/${weapon.slug}/`} className="inspect__open">
        Open dossier
        <Icon name="arrow-right" size={16} />
      </Link>
    </>
  );

  if (phone) {
    return (
      <dialog
        ref={sheet}
        className="inspect inspect--sheet"
        aria-labelledby={titleId}
        onClose={onClose}
        onClick={(event) => {
          if (event.target === sheet.current) sheet.current.close();
        }}
      >
        {body}
      </dialog>
    );
  }
  return (
    <section className="inspect shape shape--frame" aria-labelledby={titleId}>
      {body}
    </section>
  );
}
