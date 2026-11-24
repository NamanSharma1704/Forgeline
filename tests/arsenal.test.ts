/**
 * The arsenal store's rules: what is stored, what survives a round trip through a file, and what a
 * bad file is told. The M5 acceptance criterion "an export reimports losslessly" is tested here.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { WeaponIndex } from '../src/data/types';
import { createEvaluator, createGraph } from '../src/engine';
import {
  ArsenalFileError,
  EMPTY_ARSENAL,
  exportFile,
  parseArsenal,
  qtyIn,
  setQty,
  setStatus,
  statusIn,
  tally,
  toEngineArsenal,
  type StoredArsenal,
} from '../src/store/arsenal';

const NOW = '2026-11-24T18:00:00.000Z';
const ROOT = path.resolve(import.meta.dirname, '..');
const index = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'index.json'), 'utf8')
) as WeaponIndex;
const known = new Set(index.weapons.map((w) => w.slug));

const build = (...steps: [string, Parameters<typeof setStatus>[2], number?][]): StoredArsenal =>
  steps.reduce<StoredArsenal>((arsenal, [slug, status, qty]) => {
    const next = setStatus(arsenal, slug, status, NOW);
    return qty ? setQty(next, slug, qty, NOW) : next;
  }, EMPTY_ARSENAL);

describe('changing statuses', () => {
  it('never stores the default', () => {
    const a = build(['bolto', 'mastered'], ['bolto', 'notOwned']);
    expect(a.entries).toEqual({});
    expect(statusIn(a, 'bolto')).toBe('notOwned');
  });

  it('keeps a quantity only while the weapon is held, and only above one', () => {
    let a = build(['bolto', 'owned', 3]);
    expect(a.entries.bolto).toEqual({ status: 'owned', qty: 3 });
    a = setStatus(a, 'bolto', 'mastered', NOW);
    expect(a.entries.bolto).toEqual({ status: 'mastered', qty: 3 });
    a = setStatus(a, 'bolto', 'sold', NOW);
    expect(a.entries.bolto).toEqual({ status: 'sold' });
    expect(qtyIn(a, 'bolto')).toBe(0);
    a = setQty(build(['lato', 'owned', 4]), 'lato', 1, NOW);
    expect(a.entries.lato).toEqual({ status: 'owned' });
  });

  it('clamps nonsense quantities and ignores them for weapons not held', () => {
    expect(build(['bolto', 'owned', 500]).entries.bolto).toEqual({ status: 'owned', qty: 99 });
    expect(setQty(EMPTY_ARSENAL, 'bolto', 4, NOW)).toBe(EMPTY_ARSENAL);
  });

  it('never mutates the arsenal it was given', () => {
    const before = build(['bolto', 'owned']);
    const snapshot = JSON.stringify(before);
    setStatus(before, 'lato', 'mastered', NOW);
    setQty(before, 'bolto', 5, NOW);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('counts sold as mastered for progress', () => {
    expect(tally(build(['a', 'owned'], ['b', 'mastered'], ['c', 'sold']))).toEqual({
      owned: 1,
      mastered: 1,
      sold: 1,
      masteryDone: 2,
      recorded: 3,
    });
  });
});

describe('files', () => {
  it('exports and reimports losslessly', () => {
    const original = build(
      ['bolto', 'mastered', 2],
      ['lato', 'owned', 3],
      ['akbolto', 'sold'],
      ['braton', 'mastered']
    );
    const text = exportFile(original, NOW);
    const parsed = parseArsenal(JSON.parse(text), known);
    expect(parsed.arsenal.entries).toEqual(original.entries);
    expect(parsed.unknown).toEqual([]);
    expect(parsed.invalid).toBe(0);
  });

  it('reads what localStorage holds, which has no file marker', () => {
    const original = build(['bolto', 'mastered']);
    expect(parseArsenal(JSON.parse(JSON.stringify(original))).arsenal.entries).toEqual(original.entries);
  });

  it('drops weapons this build does not know and reports them', () => {
    const parsed = parseArsenal(
      { kind: 'forgeline-arsenal', schema: 1, entries: { bolto: { status: 'owned' }, 'not-a-gun': { status: 'mastered' } } },
      known
    );
    expect(Object.keys(parsed.arsenal.entries)).toEqual(['bolto']);
    expect(parsed.unknown).toEqual(['not-a-gun']);
  });

  it('drops entries with impossible statuses instead of failing the file', () => {
    const parsed = parseArsenal({
      schema: 1,
      entries: { bolto: { status: 'mastered' }, lato: { status: 'loved' }, braton: 'mastered', skana: { status: 'notOwned' } },
    });
    expect(Object.keys(parsed.arsenal.entries)).toEqual(['bolto']);
    expect(parsed.invalid).toBe(2);
  });

  it.each([
    ['a string', 'hello', 'not a Forgeline arsenal file'],
    ['an array', [], 'not a Forgeline arsenal file'],
    ['another app file', { kind: 'other-app', schema: 1, entries: {} }, 'not a Forgeline arsenal file'],
    ['a file without a version', { entries: {} }, 'missing its version'],
    ['a file from a newer version', { schema: 2, entries: {} }, 'newer version of Forgeline'],
    ['a file without weapons', { schema: 1 }, 'no weapon list'],
  ])('refuses %s with a message a person can act on', (_label, raw, message) => {
    expect(() => parseArsenal(raw)).toThrow(ArsenalFileError);
    expect(() => parseArsenal(raw)).toThrow(message);
  });
});

describe('the M5 acceptance criterion', () => {
  it('marking Akbolto and Hystrix mastered flips Bolto from Keep to Safe to sell', () => {
    const graph = createGraph(index.weapons);
    const start = build(['braton', 'mastered']);
    expect(createEvaluator(graph, toEngineArsenal(start)).verdict('bolto').kind).toBe('keep');

    const done = setStatus(setStatus(start, 'akbolto', 'mastered', NOW), 'hystrix', 'mastered', NOW);
    const verdict = createEvaluator(graph, toEngineArsenal(done)).verdict('bolto');
    expect(verdict.kind).toBe('safe');
    expect(verdict.kind === 'safe' && verdict.basis).toBe('all-mastered');
  });
});
