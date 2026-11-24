/**
 * Quick setup (M6.5, 12.5): the groups it walks, the tap cycle, "All mastered" and its undo.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { WeaponIndex } from '../src/data/types';
import { EMPTY_ARSENAL, setFavourite, setQty, setStatus, setStatuses, statusIn } from '../src/store/arsenal';
import { allMastered, nextStatus, setupSteps } from '../src/store/setup';

const NOW = '2026-11-24T18:00:00.000Z';
const ROOT = path.resolve(import.meta.dirname, '..');
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'index.json'), 'utf8')) as WeaponIndex;
const recipeWeapons = index.weapons.filter((w) => w.usedToBuild.length > 0 || w.madeFrom.length > 0);

describe('the steps', () => {
  const steps = setupSteps(recipeWeapons);

  it('walks all 87 recipe weapons, ingredients and what they build, each once', () => {
    const slugs = steps.flatMap((step) => step.rows.map((row) => row.slug));
    expect(slugs).toHaveLength(87);
    expect(new Set(slugs).size).toBe(87);
  });

  it('in three mastery-rank groups, lowest first, by rank then name within each', () => {
    expect(steps.map((step) => [step.label, step.rows.length])).toEqual([
      ['Mastery rank 0 to 4', 33],
      ['Mastery rank 5 to 8', 33],
      ['Mastery rank 9 and up', 21],
    ]);
    for (const step of steps) {
      const order = step.rows.map((row) => `${String(row.masteryReq).padStart(2, '0')} ${row.name}`);
      expect(order).toEqual([...order].sort((a, b) => a.localeCompare(b, 'en')));
    }
  });
});

describe('a tap', () => {
  it('moves a weapon through every status and back round', () => {
    expect(['notOwned', 'owned', 'mastered', 'sold'].map((s) => nextStatus(s as never))).toEqual([
      'owned',
      'mastered',
      'sold',
      'notOwned',
    ]);
  });
});

describe('All mastered, and undo', () => {
  const start = setStatuses(EMPTY_ARSENAL, { lato: 'owned', bolto: 'sold' }, NOW);
  const withCopies = setFavourite(setQty(start, 'lato', 3, NOW), 'lato', true, NOW);
  const group = ['lato', 'bolto', 'akbolto'];

  it('masters everything not yet mastered, and leaves Sold alone', () => {
    const changes = allMastered(group, (slug) => statusIn(withCopies, slug));
    expect(changes).toEqual({ lato: 'mastered', akbolto: 'mastered' });
    const after = setStatuses(withCopies, changes, NOW);
    expect(after.entries).toEqual({
      lato: { status: 'mastered', qty: 3, favourite: true },
      bolto: { status: 'sold' },
      akbolto: { status: 'mastered' },
    });
  });

  it('undoes back to exactly where it was', () => {
    const changes = allMastered(group, (slug) => statusIn(withCopies, slug));
    const previous = Object.fromEntries(Object.keys(changes).map((slug) => [slug, statusIn(withCopies, slug)]));
    const undone = setStatuses(setStatuses(withCopies, changes, NOW), previous, NOW);
    expect(undone.entries).toEqual(withCopies.entries);
  });

  it('changes as setStatus would, one at a time', () => {
    const oneByOne = setStatus(setStatus(EMPTY_ARSENAL, 'lato', 'owned', NOW), 'bolto', 'sold', NOW);
    expect(start).toEqual(oneByOne);
  });
});
