'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { OwnershipStatus } from '@/data/types';
import { STATUS_LABEL, statusIn } from '@/store/arsenal';
import { allMastered, nextStatus, setupSteps } from '@/store/setup';
import { arsenalActions, useArsenal } from '@/store/useArsenal';
import type { ArsenalRow } from './ArsenalManager';
import { WeaponArt } from './WeaponArt';

/**
 * Quick setup (M6.5, 12.5): the recipe weapons a mastery-rank group at a time. One tap moves a
 * weapon through Not owned, Owned, Mastered and Sold; a whole group can be marked mastered at once,
 * and that can be undone. Every change saves as it happens, so leaving halfway loses nothing.
 */
export function QuickSetup({ rows, onClose }: { rows: readonly ArsenalRow[]; onClose: () => void }) {
  const { ready, arsenal } = useArsenal();
  const steps = useMemo(() => setupSteps(rows), [rows]);
  const [step, setStep] = useState(0);
  const [undo, setUndo] = useState<{ step: number; previous: Record<string, OwnershipStatus> } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  // Each step, and the end, starts with its heading, so keyboard and screen reader users land there.
  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  const status = (slug: string) => (ready ? statusIn(arsenal, slug) : 'notOwned');
  const count = (wanted: OwnershipStatus) => rows.filter((row) => status(row.slug) === wanted).length;
  const marked = rows.filter((row) => status(row.slug) !== 'notOwned').length;

  if (step >= steps.length) {
    return (
      <section className="setup panel" aria-labelledby="setup-title">
        <h2 id="setup-title" className="setup__title" ref={heading} tabIndex={-1}>
          Set up
        </h2>
        <p>
          Of the {rows.length} recipe weapons, you marked {count('mastered')} mastered, {count('owned')} owned
          and {count('sold')} sold. Every Keep or Safe on the site now follows that.
        </p>
        <p className="muted">
          Change any of them later here, or on a weapon&apos;s own page. The rest of the arsenal, the
          weapons no recipe uses, only matters for your mastery count.
        </p>
        <div className="setup__actions">
          <Link href="/sweep/" className="button">
            Sort my weapons
          </Link>
          <button type="button" className="button button--quiet" onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    );
  }

  const current = steps[step]!;
  const slugs = current.rows.map((row) => row.slug);
  const bulk = allMastered(slugs, status);
  const undoHere = undo && undo.step === step ? undo : null;

  return (
    <section className="setup panel" aria-labelledby="setup-title">
      <div className="setup__head">
        <h2 id="setup-title" className="setup__title" ref={heading} tabIndex={-1}>
          Quick setup: {current.label}
        </h2>
        <p className="setup__progress">
          Step {step + 1} of {steps.length} · {marked} of {rows.length} marked
        </p>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label="Quick setup steps"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={step}
      >
        <span className="progress__fill" style={{ width: `${(step / steps.length) * 100}%` }} />
      </div>

      <p className="setup__help">
        Tap a weapon to move it on: Not owned, Owned, Mastered, Sold. Anything you leave counts as
        Not owned.
      </p>

      <div className="setup__bulk">
        <button
          type="button"
          className="button button--small button--quiet"
          disabled={!ready || Object.keys(bulk).length === 0}
          onClick={() => {
            setUndo({ step, previous: Object.fromEntries(Object.keys(bulk).map((slug) => [slug, status(slug)])) });
            arsenalActions.setStatuses(bulk);
          }}
        >
          All {current.rows.length} mastered
        </button>
        {undoHere && (
          <button
            type="button"
            className="link-button"
            onClick={() => {
              arsenalActions.setStatuses(undoHere.previous);
              setUndo(null);
            }}
          >
            Undo
          </button>
        )}
      </div>

      <ul className="setup__grid">
        {current.rows.map((row) => {
          const now = status(row.slug);
          const next = nextStatus(now);
          return (
            <li key={row.slug}>
              <button
                type="button"
                className="setup-tile shape"
                data-status={now}
                disabled={!ready}
                aria-label={`${row.name}: ${STATUS_LABEL[now]}. Activate for ${STATUS_LABEL[next]}.`}
                onClick={() => {
                  arsenalActions.setStatus(row.slug, next);
                  setUndo(null);
                }}
              >
                <WeaponArt weapon={row} size="medium" />
                <span className="setup-tile__name">{row.name}</span>
                <span className="setup-tile__meta">MR {row.masteryReq}</span>
                <span className="setup-tile__status">{STATUS_LABEL[now]}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="setup__nav">
        <button
          type="button"
          className="button button--quiet"
          disabled={step === 0}
          onClick={() => setStep(step - 1)}
        >
          Back
        </button>
        <button type="button" className="button" onClick={() => setStep(step + 1)}>
          {step === steps.length - 1 ? 'Finish' : `Next: ${steps[step + 1]!.label}`}
        </button>
        <button type="button" className="link-button setup__close" onClick={onClose}>
          Stop for now
        </button>
      </div>
    </section>
  );
}
