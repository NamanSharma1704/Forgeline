/**
 * Weapon variants, read from names: the rule on its own, then across every weapon in the index.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { WeaponIndex } from '../src/data/types';
import { VARIANT_ORDER, variantOf } from '../src/data/variants';
import { otherVersions, versionCallouts, versionsOf } from '../src/data/weapons';

const ROOT = path.resolve(import.meta.dirname, '..');
const index = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'index.json'), 'utf8')
) as WeaponIndex;

describe('variantOf', () => {
  it.each([
    ['Braton', 'normal', null, 'Braton'],
    ['Braton Prime', 'prime', 'Prime', 'Braton'],
    ['Braton Vandal', 'event', 'Vandal', 'Braton'],
    ['Latron Wraith', 'event', 'Wraith', 'Latron'],
    ['Mk1-Braton', 'other', 'MK1', 'Braton'],
    ['Kuva Bramma', 'lich', 'Kuva', 'Bramma'],
    ['Tenet Arca Plasmor', 'lich', 'Tenet', 'Arca Plasmor'],
    ['Coda Hema', 'lich', 'Coda', 'Hema'],
    ['Prisma Dual Decurions', 'prisma', 'Prisma', 'Dual Decurions'],
    ['Rakta Dark Dagger', 'syndicate', 'Rakta', 'Dark Dagger'],
    ['Telos Akbolto', 'syndicate', 'Telos', 'Akbolto'],
    ['Mutalist Quanta', 'other', 'Mutalist', 'Quanta'],
    ['Dex Sybaris', 'other', 'Dex', 'Sybaris'],
    // Names that only look like variants stay normal.
    ['Akbolto', 'normal', null, 'Akbolto'],
    ['Dark Dagger', 'normal', null, 'Dark Dagger'],
    ['Twin Kohm', 'normal', null, 'Twin Kohm'],
  ])('%s is %s', (name, variant, line, base) => {
    expect(variantOf(name)).toEqual({ variant, line, base });
  });
});

describe('variants across the index', () => {
  const counts = Object.fromEntries(VARIANT_ORDER.map((variant) => [variant, 0])) as Record<string, number>;
  for (const weapon of index.weapons) counts[variantOf(weapon.name).variant]! += 1;

  it('puts every weapon in exactly one group', () => {
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(index.weapons.length);
  });

  it('counts each group as the data has it today', () => {
    expect(counts).toEqual({
      normal: 385,
      prime: 115,
      lich: 50,
      event: 22,
      prisma: 15,
      syndicate: 18,
      other: 16,
    });
  });

  it('agrees with the source: every Prime in the name is a Prime', () => {
    const primes = index.weapons.filter((w) => w.name.endsWith(' Prime'));
    expect(primes.every((w) => variantOf(w.name).variant === 'prime')).toBe(true);
  });
});

describe('otherVersions', () => {
  const names = (slug: string) => otherVersions(slug).map((w) => w.name);

  it('lists the rest of a family, normal first, then by variant', () => {
    expect(names('braton')).toEqual(['Braton Prime', 'Braton Vandal', 'Mk1-Braton']);
    expect(names('braton-prime')).toEqual(['Braton', 'Braton Vandal', 'Mk1-Braton']);
    expect(names('quanta')).toEqual(['Tenet Quanta', 'Quanta Vandal', 'Mutalist Quanta']);
  });

  it('is empty for a weapon with no other version', () => {
    expect(names('kuva-bramma')).toEqual([]);
  });
});

describe('versions ribbon and recipe callouts (M6.5, 12.4)', () => {
  it('the ribbon holds the whole family, the weapon itself in its place', () => {
    expect(versionsOf('braton-prime').map((w) => w.name)).toEqual([
      'Braton',
      'Braton Prime',
      'Braton Vandal',
      'Mk1-Braton',
    ]);
    expect(versionsOf('kuva-bramma').map((w) => w.name)).toEqual(['Kuva Bramma']);
  });

  it('says both ways round which Lex a recipe takes', () => {
    expect(versionCallouts('lex')).toEqual([
      'Aklex needs Lex itself: Lex Prime does not count.',
      'Aklex Prime takes Lex Prime, not Lex.',
    ]);
    expect(versionCallouts('lex-prime')).toEqual([
      'Aklex Prime needs Lex Prime itself: Lex does not count.',
      'Aklex takes Lex, not Lex Prime.',
    ]);
  });

  it('groups targets that share the same versions into one sentence', () => {
    expect(versionCallouts('vasto-prime')).toContain('Akvasto and Redeemer take Vasto, not Vasto Prime.');
    expect(versionCallouts('lato')).toEqual(['Bolto needs Lato itself: Lato Prime and Lato Vandal do not count.']);
  });

  it('never weighs a weapon against its own recipe, nor says "not this one" on the way there', () => {
    // Mutalist Cernos is a Cernos version and is built from Cernos.
    expect(versionCallouts('cernos')).toEqual([
      'Mutalist Cernos needs Cernos itself: Cernos Prime and Rakta Cernos do not count.',
    ]);
    for (const slug of ['cernos', 'cernos-prime', 'mutalist-cernos', 'rakta-cernos']) {
      expect(versionCallouts(slug).some((c) => c.startsWith('Mutalist Cernos takes Cernos, not Mutalist'))).toBe(false);
    }
  });

  it('says nothing when no version is in a recipe', () => {
    expect(versionCallouts('braton')).toEqual([]);
  });
});
