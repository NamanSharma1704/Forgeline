'use client';

import Link from 'next/link';
import { useId, useMemo, useRef, useState } from 'react';
import { SLOT_LABEL, type OwnershipStatus, type Slot } from '@/data/types';
import { VARIANT_LABEL, VARIANT_ORDER, type Variant } from '@/data/variants';
import { normalise } from '@/search/rank';
import {
  ArsenalFileError,
  exportFile,
  parseArsenal,
  STATUS_LABEL,
  STATUSES,
  statusIn,
  tally,
  type ParsedArsenal,
} from '@/store/arsenal';
import { arsenalActions, useArsenal } from '@/store/useArsenal';
import { FavouriteToggle } from './FavouriteToggle';
import { Icon } from './Icon';
import { QtyStepper } from './QtyStepper';
import { StatusPicker } from './StatusPicker';
import { QuickSetup } from './QuickSetup';
import { WeaponArt, type ArtWeapon } from './WeaponArt';

/**
 * My Arsenal (spec 5.4). Opens on the 87 recipe weapons, the ones that decide every Keep or Safe
 * (docs/spec-review.md gap 7); all 621 are one filter away.
 */

export type RecipeRole = 'ingredient' | 'target' | 'both' | 'none';

export interface ArsenalRow extends ArtWeapon {
  readonly slug: string;
  readonly role: RecipeRole;
  readonly variant: Variant;
  readonly masteryReq: number;
}

type Scope = 'recipe' | 'ingredients' | 'all';

const SLOT_ORDER: Slot[] = ['primary', 'secondary', 'melee', 'arch-gun', 'arch-melee', 'companion'];

const inScope = (row: ArsenalRow, scope: Scope) =>
  scope === 'all' ||
  (scope === 'recipe' && row.role !== 'none') ||
  (scope === 'ingredients' && (row.role === 'ingredient' || row.role === 'both'));

const isIngredient = (row: ArsenalRow) => row.role === 'ingredient' || row.role === 'both';

function StatusSelect({ slug, name }: { slug: string; name: string }) {
  const { ready, arsenal } = useArsenal();
  return (
    <select
      className="tile-select"
      aria-label={`Your ${name}`}
      value={ready ? statusIn(arsenal, slug) : ''}
      onChange={(event) => arsenalActions.setStatus(slug, event.target.value as OwnershipStatus)}
    >
      {!ready && <option value="">Loading</option>}
      {STATUSES.map((status) => (
        <option key={status} value={status}>
          {STATUS_LABEL[status]}
        </option>
      ))}
    </select>
  );
}

function Starters({ rows }: { rows: readonly ArsenalRow[] }) {
  const { ready, arsenal } = useArsenal();
  return (
    <ul className="starters">
      {rows.map((row) => {
        const status = ready ? statusIn(arsenal, row.slug) : 'notOwned';
        const picked = status !== 'notOwned';
        return (
          <li key={row.slug}>
            <button
              type="button"
              className="starter shape"
              aria-pressed={picked}
              onClick={() =>
                // Toggle Owned on and off; never downgrade a weapon already mastered or sold.
                status === 'notOwned'
                  ? arsenalActions.setStatus(row.slug, 'owned')
                  : status === 'owned' && arsenalActions.setStatus(row.slug, 'notOwned')
              }
            >
              <WeaponArt weapon={row} size="medium" />
              <span className="starter__name">{row.name}</span>
              <span className="starter__state">{picked ? STATUS_LABEL[status] : 'Tap to mark owned'}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

type FileState =
  | { kind: 'idle' }
  | { kind: 'confirm-import'; parsed: ParsedArsenal; fileName: string }
  | { kind: 'confirm-clear' }
  | { kind: 'message'; text: string; tone: 'ok' | 'error' };

export function ArsenalManager({
  rows,
  starters,
}: {
  rows: readonly ArsenalRow[];
  starters: readonly ArsenalRow[];
}) {
  const id = useId();
  const { ready, arsenal } = useArsenal();
  const [scope, setScope] = useState<Scope>('recipe');
  const [slot, setSlot] = useState<Slot | 'all'>('all');
  const [variant, setVariant] = useState<Variant | 'all'>('all');
  const [status, setStatus] = useState<OwnershipStatus | 'any'>('any');
  const [text, setText] = useState('');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [setupOpen, setSetupOpen] = useState(false);
  const [file, setFile] = useState<FileState>({ kind: 'idle' });
  const fileInput = useRef<HTMLInputElement>(null);

  const known = useMemo(() => new Set(rows.map((row) => row.slug)), [rows]);
  const recipeRows = useMemo(() => rows.filter((row) => row.role !== 'none'), [rows]);
  const scopeCount = useMemo(
    () => ({
      recipe: rows.filter((row) => inScope(row, 'recipe')).length,
      ingredients: rows.filter((row) => inScope(row, 'ingredients')).length,
      all: rows.length,
    }),
    [rows]
  );

  const totals = tally(arsenal);
  const recipeMarked = rows.filter((row) => row.role !== 'none' && arsenal.entries[row.slug]).length;
  const masteredShare = rows.length ? totals.masteryDone / rows.length : 0;

  // Variant counts follow the scope, so "Prime 8" means eight Primes among the weapons shown. A
  // variant with none in scope is hidden, unless it is the one selected.
  const variantCounts = useMemo(() => {
    const counts = new Map<Variant, number>();
    for (const row of rows) {
      if (inScope(row, scope)) counts.set(row.variant, (counts.get(row.variant) ?? 0) + 1);
    }
    return counts;
  }, [rows, scope]);
  const variantCount = (candidate: Variant) => variantCounts.get(candidate) ?? 0;
  const variants = VARIANT_ORDER.filter(
    (candidate) => variantCount(candidate) > 0 || candidate === variant
  );

  const needle = normalise(text);
  const visible = rows.filter(
    (row) =>
      inScope(row, scope) &&
      (variant === 'all' || row.variant === variant) &&
      (slot === 'all' || row.slot === slot) &&
      (status === 'any' || (ready && statusIn(arsenal, row.slug) === status)) &&
      (!needle || normalise(row.name).includes(needle))
  );

  const download = () => {
    const blob = new Blob([exportFile(arsenal, new Date().toISOString())], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `forgeline-arsenal-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFile({ kind: 'message', tone: 'ok', text: `Saved ${totals.recorded} weapons to a file.` });
  };

  const readFile = async (chosen: File | undefined) => {
    if (!chosen) return;
    try {
      const parsed = parseArsenal(JSON.parse(await chosen.text()), known);
      setFile({ kind: 'confirm-import', parsed, fileName: chosen.name });
    } catch (error) {
      setFile({
        kind: 'message',
        tone: 'error',
        text:
          error instanceof ArsenalFileError
            ? error.message
            : 'That file could not be read. Choose a file saved from Forgeline.',
      });
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const slots = SLOT_ORDER.filter((candidate) => rows.some((row) => row.slot === candidate));

  return (
    <>
      <section className="arsenal-summary" aria-label="Progress">
        <div
          className="progress"
          role="progressbar"
          aria-label="Weapons mastered"
          aria-valuemin={0}
          aria-valuemax={rows.length}
          aria-valuenow={ready ? totals.masteryDone : 0}
        >
          <span className="progress__fill" style={{ width: `${ready ? masteredShare * 100 : 0}%` }} />
        </div>
        <p className="arsenal-summary__line">
          <strong>{ready ? totals.masteryDone : '…'}</strong> of {rows.length} weapons mastered
          {ready && totals.owned > 0 && <span className="muted"> · {totals.owned} owned, not mastered yet</span>}
        </p>
        <p className="arsenal-summary__line muted">
          Recipe weapons marked: {ready ? recipeMarked : '…'} of {scopeCount.recipe}. These decide every
          Keep or Safe verdict on the site.
          {ready && recipeMarked > 0 && !setupOpen && (
            <>
              {' '}
              <button type="button" className="link-button" onClick={() => setSetupOpen(true)}>
                Go through them again
              </button>
            </>
          )}
        </p>
      </section>

      {setupOpen ? (
        <QuickSetup rows={recipeRows} onClose={() => setSetupOpen(false)} />
      ) : (
        ready &&
        recipeMarked === 0 && (
          <section className="setup-banner panel" aria-labelledby="setup-banner-title">
            <div>
              <h2 id="setup-banner-title" className="setup__title">
                Quick setup, about two minutes
              </h2>
              <p className="muted">
                Mark the {scopeCount.recipe} weapons that decide every verdict, one mastery-rank group at
                a time. A tap changes a weapon, and a whole group can be marked mastered at once.
              </p>
            </div>
            <button type="button" className="button" onClick={() => setSetupOpen(true)}>
              Start quick setup
            </button>
          </section>
        )
      )}

      {starters.length > 0 && (
        <details className="panel">
          <summary className="panel__summary">Starting out? Mark your tutorial weapons</summary>
          <p className="muted panel__intro">Tap the starter weapons you picked to mark them Owned.</p>
          <Starters rows={starters} />
        </details>
      )}

      <div className="filters">
        <div className="chips" role="group" aria-label="Which weapons">
          {(['recipe', 'ingredients', 'all'] as Scope[]).map((candidate) => (
            <button
              key={candidate}
              type="button"
              className="chip"
              aria-pressed={scope === candidate}
              onClick={() => setScope(candidate)}
            >
              {candidate === 'recipe' ? 'Recipe weapons' : candidate === 'ingredients' ? 'Ingredients' : 'All weapons'}{' '}
              <span className="chip__count">{scopeCount[candidate]}</span>
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Filter by variant">
          <button
            type="button"
            className="chip"
            aria-pressed={variant === 'all'}
            onClick={() => setVariant('all')}
          >
            Any variant
          </button>
          {variants.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className="chip"
              aria-pressed={variant === candidate}
              onClick={() => setVariant(candidate)}
            >
              {VARIANT_LABEL[candidate]} <span className="chip__count">{variantCount(candidate)}</span>
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Filter by slot">
          <button type="button" className="chip" aria-pressed={slot === 'all'} onClick={() => setSlot('all')}>
            Any slot
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
        <label className="field" htmlFor={`${id}-status`}>
          Status
          <select id={`${id}-status`} value={status} onChange={(e) => setStatus(e.target.value as OwnershipStatus | 'any')}>
            <option value="any">Any</option>
            {STATUSES.map((candidate) => (
              <option key={candidate} value={candidate}>
                {STATUS_LABEL[candidate]}
              </option>
            ))}
          </select>
        </label>
        <label className="field" htmlFor={`${id}-text`}>
          Name
          <input
            id={`${id}-text`}
            type="text"
            value={text}
            placeholder="Filter by name"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <div className="chips" role="group" aria-label="View">
          <button type="button" className="chip" aria-pressed={view === 'list'} onClick={() => setView('list')}>
            List
          </button>
          <button type="button" className="chip" aria-pressed={view === 'grid'} onClick={() => setView('grid')}>
            Pictures
          </button>
        </div>
      </div>

      <p className="result-count" role="status" aria-live="polite">
        Showing {visible.length} of {scopeCount[scope]}
      </p>

      {visible.length === 0 ? (
        <div className="empty">
          <p>No weapon matches these filters.</p>
          <button
            type="button"
            className="button"
            onClick={() => {
              setSlot('all');
              setVariant('all');
              setStatus('any');
              setText('');
            }}
          >
            Clear filters
          </button>
        </div>
      ) : view === 'list' ? (
        <ul className="arsenal-list">
          {visible.map((row) => (
            <li key={row.slug} className="arsenal-row">
              <Link href={`/w/${row.slug}/`} className="arsenal-row__weapon">
                <WeaponArt weapon={row} />
                <span>
                  <span className="arsenal-row__name">{row.name}</span>
                  <span className="arsenal-row__meta">
                    {SLOT_LABEL[row.slot]}
                    {isIngredient(row) && <span className="arsenal-row__role"> · ingredient</span>}
                  </span>
                </span>
              </Link>
              <div className="arsenal-row__controls">
                <StatusPicker slug={row.slug} name={row.name} size="small" />
                {isIngredient(row) && <QtyStepper slug={row.slug} name={row.name} />}
                <FavouriteToggle slug={row.slug} name={row.name} compact />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="arsenal-grid">
          {visible.map((row) => (
            <li key={row.slug} className="arsenal-tile">
              <Link href={`/w/${row.slug}/`} className="arsenal-tile__link">
                <WeaponArt weapon={row} size="medium" />
                <span className="arsenal-tile__name">{row.name}</span>
              </Link>
              <StatusSelect slug={row.slug} name={row.name} />
            </li>
          ))}
        </ul>
      )}

      <section className="section panel files" aria-labelledby={`${id}-files`}>
        <h2 id={`${id}-files`} className="section-title">
          Keep a copy
        </h2>
        <p className="muted">
          Your arsenal lives in this browser only. Save it to a file to move it to another device, or
          to get it back after clearing your browser data.
        </p>
        <div className="files__actions">
          <button type="button" className="button" onClick={download} disabled={!ready || totals.recorded === 0}>
            <Icon name="download" size={20} />
            Save to a file
          </button>
          <button type="button" className="button" onClick={() => fileInput.current?.click()}>
            <Icon name="upload" size={20} />
            Load a file
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => readFile(event.target.files?.[0])}
          />
          <button
            type="button"
            className="button button--quiet"
            onClick={() => setFile({ kind: 'confirm-clear' })}
            disabled={!ready || totals.recorded === 0}
          >
            Clear everything
          </button>
        </div>

        <div role="status" aria-live="polite" className="files__status">
          {file.kind === 'message' && <p className={`files__message files__message--${file.tone}`}>{file.text}</p>}
          {file.kind === 'confirm-import' && (
            <div className="confirm">
              <p>
                <strong>{file.fileName}</strong> holds {Object.keys(file.parsed.arsenal.entries).length} weapons
                {file.parsed.unknown.length > 0 &&
                  `, plus ${file.parsed.unknown.length} this version of Forgeline does not know, which will be skipped`}
                . Loading it replaces the {totals.recorded} weapons saved here.
              </p>
              <div className="confirm__actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    arsenalActions.replace(file.parsed.arsenal);
                    setFile({
                      kind: 'message',
                      tone: 'ok',
                      text: `Loaded ${Object.keys(file.parsed.arsenal.entries).length} weapons.`,
                    });
                  }}
                >
                  Replace my arsenal
                </button>
                <button type="button" className="button button--quiet" onClick={() => setFile({ kind: 'idle' })}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {file.kind === 'confirm-clear' && (
            <div className="confirm">
              <p>
                Clear all {totals.recorded} marked weapons? This cannot be undone unless you saved a file
                first.
              </p>
              <div className="confirm__actions">
                <button
                  type="button"
                  className="button button--danger"
                  onClick={() => {
                    arsenalActions.clear();
                    setFile({ kind: 'message', tone: 'ok', text: 'Arsenal cleared.' });
                  }}
                >
                  Clear everything
                </button>
                <button type="button" className="button button--quiet" onClick={() => setFile({ kind: 'idle' })}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
