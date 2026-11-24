/**
 * The monthly refresh's publish gate, against the real index with deliberate damage.
 *
 * The property that matters: no change to the recipe graph reaches the site without a person, and
 * no change that looks like a broken source reaches it at all.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Weapon, WeaponIndex } from '../src/data/types';
import {
  changelogEntry,
  decide,
  diffIndexes,
  newSlugs,
  renderReport,
} from '../scripts/lib/refresh.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const base = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'index.json'), 'utf8')
) as WeaponIndex;

const clone = (): WeaponIndex => structuredClone(base);
const weapon = (index: WeaponIndex, slug: string): Weapon => {
  const found = index.weapons.find((w) => w.slug === slug);
  if (!found) throw new Error(`no ${slug} in index`);
  return found;
};
/** Remove the recipe edge from `from` to `to`, on both sides, as a broken source would. */
const dropEdge = (index: WeaponIndex, from: string, to: string) => {
  weapon(index, from).usedToBuild = weapon(index, from).usedToBuild.filter((e) => e.slug !== to);
  weapon(index, to).madeFrom = weapon(index, to).madeFrom.filter((e) => e.slug !== from);
};

describe('what counts as a change', () => {
  it('an identical index is unchanged', () => {
    const report = diffIndexes(base, clone());
    expect(report.changed).toBe(false);
    expect(decide(report).status).toBe('unchanged');
  });

  it('a new package version with identical data is unchanged, so nothing deploys', () => {
    const next = clone();
    next.sourceVersion = '9.9.9';
    next.generatedAt = '2027-01-01T06:00:00.000Z';
    expect(decide(diffIndexes(base, next)).status).toBe('unchanged');
  });

  it('a New badge expiring is a change, so the badge comes off the site', () => {
    const old = clone();
    weapon(old, 'braton').isNew = true;
    const report = diffIndexes(old, clone());
    expect(report.displayChanges).toEqual([{ slug: 'braton', name: 'Braton', fields: ['isNew'] }]);
    expect(decide(report).status).toBe('publish');
  });
});

describe('what publishes on its own', () => {
  it('a new weapon outside the recipe graph', () => {
    const next = clone();
    next.weapons.push({
      ...weapon(next, 'braton'),
      slug: 'test-rifle',
      name: 'Test Rifle',
      imageSource: 'TestRifle.png',
      isNew: true,
    });
    const report = diffIndexes(base, next);
    expect(report.added).toEqual([{ slug: 'test-rifle', name: 'Test Rifle' }]);
    expect(decide(report).status).toBe('publish');
  });

  it('a picture changing', () => {
    const next = clone();
    weapon(next, 'bolto').imageSource = 'BoltoNew.png';
    const report = diffIndexes(base, next);
    expect(report.imageChanges).toHaveLength(1);
    expect(decide(report).status).toBe('publish');
  });
});

describe('what needs a person', () => {
  it('a copy count changing is blocked, and publishes once accepted', () => {
    const next = clone();
    weapon(next, 'bolto').usedToBuild = weapon(next, 'bolto').usedToBuild.map((e) =>
      e.slug === 'akbolto' ? { ...e, copies: 3 } : e
    );
    const report = diffIndexes(base, next);
    expect(report.recipeChanges).toEqual([
      { slug: 'bolto', name: 'Bolto', added: [], removed: [], changed: [{ slug: 'akbolto', from: 2, to: 3 }] },
    ]);
    const blocked = decide(report);
    expect(blocked.status).toBe('blocked');
    expect(blocked.reasons.join(' ')).toContain('Recipes changed for Bolto');

    const accepted = decide(report, { accept: true });
    expect(accepted.status).toBe('publish');
    expect(accepted.accepted).toHaveLength(1);
  });

  it('a weapon silently stopping being an ingredient is blocked with the reason spelled out', () => {
    const next = clone();
    dropEdge(next, 'lato', 'bolto');
    const report = diffIndexes(base, next);
    expect(report.ingredientsRemoved).toEqual([{ slug: 'lato', name: 'Lato' }]);
    const decision = decide(report);
    expect(decision.status).toBe('blocked');
    expect(decision.reasons[0]).toBe(
      'Lato stopped being an ingredient. If that is wrong, the site would start calling it safe to sell.'
    );
  });

  it('a new ingredient is blocked until reviewed', () => {
    const next = clone();
    weapon(next, 'braton').usedToBuild = [{ slug: 'akjagara', copies: 1 }];
    weapon(next, 'akjagara').madeFrom.push({ slug: 'braton', copies: 1 });
    const report = diffIndexes(base, next);
    expect(report.ingredientsAdded.map((i) => i.slug)).toEqual(['braton']);
    expect(decide(report).status).toBe('blocked');
  });
});

describe('what never publishes, accepted or not', () => {
  it('a large swing in the ingredient count', () => {
    const next = clone();
    const ingredients = next.weapons.filter((w) => w.usedToBuild.length > 0).slice(0, 12);
    for (const w of ingredients) {
      for (const edge of [...w.usedToBuild]) dropEdge(next, w.slug, edge.slug);
    }
    const decision = decide(diffIndexes(base, next), { accept: true });
    expect(decision.status).toBe('blocked');
    expect(decision.reasons[0]).toMatch(/swing/);
  });

  it('many weapons disappearing at once', () => {
    const next = clone();
    next.weapons = next.weapons.filter((_, i) => i % 10 !== 0);
    const decision = decide(diffIndexes(base, next), { accept: true });
    expect(decision.status).toBe('blocked');
    expect(decision.reasons.some((r) => r.includes('disappeared'))).toBe(true);
  });
});

describe('New badges', () => {
  const at = (iso: string, slugs: string[], isNew: string[] = []) => ({
    generatedAt: iso,
    weapons: slugs.map((slug) => ({ ...weapon(base, 'braton'), slug, isNew: isNew.includes(slug) })),
  });

  it('marks nothing new on the very first build', () => {
    expect([...newSlugs(null, ['a', 'b'], '2026-12-01T06:00:00Z')]).toEqual([]);
  });

  it('marks weapons absent from the previous index', () => {
    const previous = at('2026-11-24T10:00:00Z', ['a']);
    expect([...newSlugs(previous, ['a', 'b'], '2026-12-01T06:00:00Z')]).toEqual(['b']);
  });

  it('keeps this month’s badges through a second refresh in the same month', () => {
    const previous = at('2026-12-01T06:00:00Z', ['a', 'b'], ['b']);
    expect([...newSlugs(previous, ['a', 'b', 'c'], '2026-12-15T09:00:00Z')].sort()).toEqual(['b', 'c']);
  });

  it('clears last month’s badges at the next monthly refresh', () => {
    const previous = at('2026-12-15T09:00:00Z', ['a', 'b'], ['b']);
    expect([...newSlugs(previous, ['a', 'b'], '2027-01-01T06:00:00Z')]).toEqual([]);
  });
});

describe('reporting', () => {
  it('writes a report that says why and what to do, without dashes', () => {
    const next = clone();
    dropEdge(next, 'lato', 'bolto');
    const report = diffIndexes(base, next);
    const markdown = renderReport(report, decide(report), { runUrl: 'https://example.test/run/1' });
    expect(markdown).toContain('## Refresh blocked: needs a person');
    expect(markdown).toContain('accept recipe changes');
    expect(markdown).toContain('Lato: no longer builds bolto x1');
    expect(markdown).not.toMatch(/[\u2013\u2014]/);
  });

  it('records a compact changelog entry', () => {
    const next = clone();
    weapon(next, 'bolto').imageSource = 'BoltoNew.png';
    const entry = changelogEntry(diffIndexes(base, next), '2026-12-01T06:00:00Z');
    expect(entry).toMatchObject({ date: '2026-12-01T06:00:00Z', imageChanges: [{ slug: 'bolto' }] });
  });
});
