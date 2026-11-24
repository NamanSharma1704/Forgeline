/**
 * Integrity tests for the committed weapon index.
 *
 * These are the publish gate from docs/build-plan.md section 8, in test form. A monthly refresh that
 * breaks any of them must not reach the site: a wrong "safe to sell" is worse than stale data.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { WeaponIndex } from '../src/data/types';

const ROOT = path.resolve(import.meta.dirname, '..');

const index = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'index.json'), 'utf8')
) as WeaponIndex;

const fixture = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'fixtures', 'verified-recipes.json'), 'utf8')
) as {
  counts: { ingredients: number };
  ingredients: { name: string; usedToBuild: { name: string; copies: number }[] }[];
};

const bySlug = new Map(index.weapons.map((weapon) => [weapon.slug, weapon]));
const byName = new Map(index.weapons.map((weapon) => [weapon.name, weapon]));
const ingredients = index.weapons.filter((weapon) => weapon.usedToBuild.length > 0);

describe('index shape', () => {
  it('is the schema the app expects', () => {
    expect(index.schema).toBe(1);
    expect(index.sourceVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(Date.parse(index.generatedAt)).not.toBeNaN();
  });

  it('agrees with its own counts', () => {
    expect(index.counts.weapons).toBe(index.weapons.length);
    expect(index.counts.ingredients).toBe(ingredients.length);
    expect(index.counts.craftable).toBe(
      index.weapons.filter((weapon) => weapon.madeFrom.length > 0).length
    );
  });

  it('has unique slugs and names', () => {
    expect(bySlug.size).toBe(index.weapons.length);
    expect(byName.size).toBe(index.weapons.length);
  });

  it('gives every weapon the fields the pages read', () => {
    for (const weapon of index.weapons) {
      expect(weapon.slug, weapon.name).toMatch(/^[a-z0-9-]+$/);
      expect(weapon.image, weapon.name).toBe(`img/${weapon.slug}.webp`);
      expect(weapon.thumb, weapon.name).toBe(`img/thumb/${weapon.slug}.webp`);
      expect(weapon.imageSource, weapon.name).toBeTruthy();
      expect(weapon.introduced, weapon.name).toBeTruthy();
      expect(weapon.masteryReq, weapon.name).toBeGreaterThanOrEqual(0);
      expect([30, 40], weapon.name).toContain(weapon.maxRank);
    }
  });
});

describe('recipe graph', () => {
  it('resolves every reference', () => {
    for (const weapon of index.weapons) {
      for (const edge of [...weapon.usedToBuild, ...weapon.madeFrom]) {
        expect(bySlug.has(edge.slug), `${weapon.slug} -> ${edge.slug}`).toBe(true);
        expect(edge.copies, `${weapon.slug} -> ${edge.slug}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('is symmetric, so a tree reads the same from either end', () => {
    for (const weapon of index.weapons) {
      for (const edge of weapon.usedToBuild) {
        const mirrored = bySlug.get(edge.slug)?.madeFrom.find((e) => e.slug === weapon.slug);
        expect(mirrored?.copies, `${weapon.slug} -> ${edge.slug}`).toBe(edge.copies);
      }
    }
  });

  it('has no weapon listed as its own ingredient', () => {
    for (const weapon of index.weapons) {
      expect(weapon.usedToBuild.some((edge) => edge.slug === weapon.slug)).toBe(false);
      expect(weapon.madeFrom.some((edge) => edge.slug === weapon.slug)).toBe(false);
    }
  });

  it('keeps the known multi-step chain intact', () => {
    // Lato, Bolto, Akbolto, Akjagara: the deepest chain in the game data.
    const lato = byName.get('Lato');
    const bolto = byName.get('Bolto');
    const akbolto = byName.get('Akbolto');
    expect(lato?.usedToBuild.map((e) => e.slug)).toContain('bolto');
    expect(bolto?.usedToBuild.find((e) => e.slug === 'akbolto')?.copies).toBe(2);
    expect(bolto?.usedToBuild.find((e) => e.slug === 'hystrix')?.copies).toBe(1);
    expect(akbolto?.usedToBuild.map((e) => e.slug)).toContain('akjagara');
  });

  it('keeps Prime and non-Prime apart', () => {
    expect(byName.get('Lex')?.usedToBuild.map((e) => e.slug)).toEqual(['aklex']);
    expect(byName.get('Lex Prime')?.usedToBuild.map((e) => e.slug)).toEqual(['aklex-prime']);
  });
});

describe('verified recipe fixture', () => {
  it('matches the derived graph exactly', () => {
    const problems: string[] = [];
    const expected = new Map(fixture.ingredients.map((row) => [row.name, row]));

    for (const [name, row] of expected) {
      const weapon = byName.get(name);
      if (!weapon) {
        problems.push(`${name} is no longer in the index`);
        continue;
      }
      const derived = new Map(
        weapon.usedToBuild.map((edge) => [bySlug.get(edge.slug)!.name, edge.copies])
      );
      for (const target of row.usedToBuild) {
        if (!derived.has(target.name)) problems.push(`${name} no longer builds ${target.name}`);
        else if (derived.get(target.name) !== target.copies) {
          problems.push(
            `${name} -> ${target.name}: expected ${target.copies}, derived ${derived.get(target.name)}`
          );
        }
      }
      for (const target of derived.keys()) {
        if (!row.usedToBuild.some((t) => t.name === target)) {
          problems.push(`${name} now also builds ${target}`);
        }
      }
    }
    for (const weapon of ingredients) {
      if (!expected.has(weapon.name)) problems.push(`${weapon.name} is a new ingredient weapon`);
    }

    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('still covers the same number of ingredient weapons', () => {
    expect(ingredients.length).toBe(fixture.counts.ingredients);
  });
});

describe('images', () => {
  it('has both tiers on disk for every weapon', () => {
    const missing = index.weapons.filter(
      (weapon) =>
        !fs.existsSync(path.join(ROOT, 'public', weapon.image)) ||
        !fs.existsSync(path.join(ROOT, 'public', weapon.thumb))
    );
    expect(missing.map((weapon) => weapon.slug)).toEqual([]);
  });
});
