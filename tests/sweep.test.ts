/**
 * The slot sweep (spec 5.5) and the browser's copy of the recipe graph.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fromGraphFile, toGraphFile } from '../src/data/graph-file';
import type { WeaponIndex } from '../src/data/types';
import { createGraph, sweep, type Arsenal } from '../src/engine';

const ROOT = path.resolve(import.meta.dirname, '..');
const index = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'index.json'), 'utf8')
) as WeaponIndex;
const graph = createGraph(index.weapons);

const reasons = (arsenal: Arsenal) => {
  const result = sweep(graph, arsenal);
  return {
    safe: result.safe.map((i) => [i.slug, i.reason]),
    keep: result.keep.map((i) => [i.slug, i.reason]),
  };
};

describe('slot sweep', () => {
  it('a mastered weapon outside every recipe is safe', () => {
    expect(reasons({ braton: { status: 'mastered' } })).toEqual({
      safe: [['braton', 'Mastered, and not used in any recipe.']],
      keep: [],
    });
  });

  it('a weapon not mastered yet is kept, whatever it builds', () => {
    expect(reasons({ braton: { status: 'owned' } }).keep).toEqual([
      ['braton', 'Not mastered yet. Level it to rank 30 first; the mastery stays after you sell it.'],
    ]);
  });

  it('quotes rank 40 for weapons that level to 40', () => {
    expect(reasons({ paracesis: { status: 'owned' } }).keep[0]?.[1]).toContain('rank 40');
  });

  it('a mastered ingredient with recipes outstanding is kept, naming them', () => {
    expect(reasons({ bolto: { status: 'mastered' } }).keep).toEqual([
      ['bolto', 'Keep 3 for Akbolto and Hystrix.'],
    ]);
  });

  it('says so when a kept ingredient is not mastered either', () => {
    expect(reasons({ lato: { status: 'owned' } }).keep).toEqual([
      ['lato', 'Keep 3 for Bolto. Not mastered yet either.'],
    ]);
  });

  it('a mastered ingredient whose whole family is mastered is safe', () => {
    expect(
      reasons({
        bolto: { status: 'mastered' },
        akbolto: { status: 'mastered' },
        hystrix: { status: 'mastered' },
      }).safe.find(([slug]) => slug === 'bolto')
    ).toEqual(['bolto', 'Mastered, and everything it builds is mastered too.']);
  });

  it('names what still needs levelling for the soft safe', () => {
    expect(
      reasons({
        bolto: { status: 'mastered' },
        akbolto: { status: 'owned' },
        hystrix: { status: 'mastered' },
      }).safe.find(([slug]) => slug === 'bolto')?.[1]
    ).toBe('Mastered, and nothing needs another copy. Level your Akbolto before selling that.');
  });

  it('only sweeps weapons the player holds, sorted by name', () => {
    const result = sweep(graph, {
      skana: { status: 'mastered' },
      braton: { status: 'mastered' },
      lato: { status: 'sold' },
    });
    expect(result.safe.map((i) => i.slug)).toEqual(['braton', 'skana']);
    expect(result.keep).toEqual([]);
  });
});

describe('the browser graph file', () => {
  it('rebuilds exactly the graph the pages were built from', () => {
    const fromFile = createGraph(fromGraphFile(toGraphFile(index.weapons)));
    for (const weapon of index.weapons) {
      const a = graph.get(weapon.slug);
      const b = fromFile.get(weapon.slug);
      expect(b.name).toBe(a.name);
      expect(b.maxRank).toBe(a.maxRank);
      expect(b.usedToBuild).toEqual(a.usedToBuild);
      expect(b.madeFrom).toEqual(a.madeFrom);
    }
    expect(fromFile.warnings).toEqual([]);
  });

  // 50,000 since ranks joined the file (tiles show them): about 44,300 today, room for new weapons.
  it('stays small', () => {
    expect(JSON.stringify(toGraphFile(index.weapons)).length).toBeLessThan(50_000);
  });
});

describe('favourites in the sweep (M6.5, 12.3)', () => {
  it('protects a favourite that would otherwise be safe to sell', () => {
    const result = sweep(graph, { braton: { status: 'mastered', favourite: true } });
    expect(result.safe).toEqual([]);
    expect(result.favourites.map((i) => [i.slug, i.reason])).toEqual([
      ['braton', 'Your favourite, so it is never suggested for sale.'],
    ]);
  });

  it('still says what a favourite is needed for, and when it is not mastered', () => {
    const result = sweep(graph, { bolto: { status: 'owned', favourite: true } });
    expect(result.keep).toEqual([]);
    expect(result.favourites[0]?.reason).toBe(
      'Your favourite, so it is never suggested for sale. Akbolto and Hystrix need it too. Not mastered yet: rank 30 is the goal.'
    );
  });

  it('leaves everything else exactly where it was', () => {
    const plain = sweep(graph, { braton: { status: 'mastered' }, skana: { status: 'mastered' } });
    const withFavourite = sweep(graph, {
      braton: { status: 'mastered' },
      skana: { status: 'mastered', favourite: true },
    });
    expect(withFavourite.safe.map((i) => i.slug)).toEqual(['braton']);
    expect(withFavourite.favourites.map((i) => i.slug)).toEqual(['skana']);
    expect(plain.favourites).toEqual([]);
  });
});
