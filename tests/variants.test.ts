/**
 * Weapon variants, read from names: the rule on its own, then across every weapon in the index.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { WeaponIndex } from '../src/data/types';
import { VARIANT_ORDER, variantOf } from '../src/data/variants';
import { otherVersions } from '../src/data/weapons';

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
