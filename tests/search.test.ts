/**
 * Search ranking against the real weapon index. These are the behaviours spec 5.1 names
 * explicitly, plus the ones a player hits in the first minute.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { WeaponIndex } from '../src/data/types';
import { createSearcher, editDistance, normalise, toSearchEntries } from '../src/search/rank';

const ROOT = path.resolve(import.meta.dirname, '..');
const index = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'index.json'), 'utf8')
) as WeaponIndex;
const entries = toSearchEntries(index.weapons);
const search = createSearcher(entries);
const slugs = (query: string, limit?: number) => search(query, limit).map((entry) => entry.s);

describe('search ranking', () => {
  it('tolerates the typo from the spec: "bolot" finds Bolto first', () => {
    expect(slugs('bolot')[0]).toBe('bolto');
  });

  it('keeps Prime and non-Prime apart, plain name first', () => {
    expect(slugs('lex').slice(0, 2)).toEqual(['lex', 'lex-prime']);
    expect(slugs('lex prime')[0]).toBe('lex-prime');
  });

  it("ranks a weapon's own variants ahead of names that merely share letters", () => {
    // "bo" must not bury Bo Prime under Boar, Bolto and Boltor.
    expect(slugs('bo').slice(0, 2)).toEqual(['bo', 'bo-prime']);
  });

  it('matches community shorthand', () => {
    expect(slugs('akbo')[0]).toBe('akbolto');
    expect(slugs('dss')[0]).toBe('dark-split-sword');
  });

  it('matches partial names, later words and punctuation-free spellings', () => {
    expect(slugs('dual sk')[0]).toBe('dual-skana');
    expect(slugs('skana')).toContain('dual-skana');
    expect(slugs('dark split sword')[0]).toBe('dark-split-sword');
    expect(slugs('mk1 braton')[0]).toBe('mk1-braton');
  });

  it('is case and spacing insensitive', () => {
    expect(slugs('  BOLTO ')[0]).toBe('bolto');
  });

  it('returns nothing for an empty or hopeless query', () => {
    expect(search('')).toEqual([]);
    expect(search('   ')).toEqual([]);
    expect(search('zzqxjv')).toEqual([]);
  });

  it('respects the result limit', () => {
    expect(search('a', 5)).toHaveLength(5);
  });

  it('ships a compact index: short keys, every weapon, no image paths', () => {
    expect(entries).toHaveLength(index.weapons.length);
    const bolto = entries.find((e) => e.s === 'bolto');
    expect(bolto).toEqual({ s: 'bolto', n: 'Bolto', t: 'secondary', b: 2 });
    const bytes = JSON.stringify(entries).length;
    expect(bytes).toBeLessThan(40_000);
  });
});

describe('helpers', () => {
  it('normalises punctuation and case', () => {
    expect(normalise('Dark Split-Sword')).toBe('dark split sword');
    expect(normalise('MK1-Braton')).toBe('mk1 braton');
  });

  it('counts a transposition as one edit', () => {
    expect(editDistance('bolot', 'bolto')).toBe(1);
    expect(editDistance('kitten', 'sitting')).toBe(3);
  });
});
