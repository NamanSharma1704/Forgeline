/**
 * Incarnon Genesis compatibility (M6.5, 12.2): the fact in the index, the rule that carries it to a
 * weapon's other versions, and what the verdict card, the copied text and the sweep say.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fromGraphFile, toGraphFile } from '../src/data/graph-file';
import type { WeaponIndex } from '../src/data/types';
import { getWeapon, graphWeapons, incarnonGenesisOf } from '../src/data/weapons';
import { createEvaluator, createGraph, explain, sweep } from '../src/engine';

const ROOT = path.resolve(import.meta.dirname, '..');
const index = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'index.json'), 'utf8')
) as WeaponIndex;
const graph = createGraph(graphWeapons());
const adapterOf = (slug: string) => incarnonGenesisOf(getWeapon(slug)!);

describe('the index', () => {
  it('records the 45 adapters on the weapons they are named for', () => {
    const named = index.weapons.filter((w) => w.incarnonGenesis);
    expect(named).toHaveLength(45);
    expect(named.every((w) => w.incarnonGenesis === `${w.name} Incarnon Genesis`)).toBe(true);
  });
});

describe('which weapons can take one', () => {
  it('the weapon itself', () => {
    expect(adapterOf('torid')).toBe('Torid Incarnon Genesis');
  });

  it.each([
    ['braton-prime', 'Braton Incarnon Genesis'],
    ['braton-vandal', 'Braton Incarnon Genesis'],
    ['mk1-braton', 'Braton Incarnon Genesis'],
    ['telos-boltor', 'Boltor Incarnon Genesis'],
    ['prisma-gorgon', 'Gorgon Incarnon Genesis'],
    ['dex-sybaris', 'Sybaris Incarnon Genesis'],
  ])('its versions: %s takes the %s', (slug, adapter) => {
    expect(adapterOf(slug)).toBe(adapter);
  });

  it.each(['aklato', 'akbolto', 'bolto', 'kuva-bramma'])(
    'not Akimbo or Dual weapons, nor weapons without one: %s',
    (slug) => {
      expect(adapterOf(slug)).toBeNull();
    }
  );

  it('is 90 weapons in all: 45 named, 45 versions', () => {
    expect(graphWeapons().filter((w) => 'incarnon' in w)).toHaveLength(90);
  });
});

describe('what the player is told', () => {
  const told = (slug: string) => explain(createEvaluator(graph, {}).verdict(slug), graph);

  it('Torid surfaces its Incarnon Genesis, and the verdict is still Safe (M6.5 done-when)', () => {
    const e = told('torid');
    expect(e.tone).toBe('safe');
    expect(e.incarnon).toBe(
      'Torid can take the Torid Incarnon Genesis, a Steel Path Circuit reward that gives it an Incarnon form. Worth keeping if you might use that, whatever the recipes say.'
    );
    expect(e.copyText).toMatch(/Can take the Torid Incarnon Genesis\.$/);
  });

  it('an ingredient gets the same note, as one more reason to keep it', () => {
    const e = told('lato');
    expect(e.tone).toBe('check');
    expect(e.incarnon).toMatch(/Lato Incarnon Genesis.*One more reason to keep it\.$/);
  });

  it('a weapon without one gets no note', () => {
    expect(told('bolto').incarnon).toBeNull();
  });

  it('the sweep keeps a mastered Torid in Safe to sell, and says why to think twice', () => {
    const result = sweep(graph, { torid: { status: 'mastered' } });
    expect(result.safe.map((i) => i.reason)).toEqual([
      'Mastered, and not used in any recipe. It can take the Torid Incarnon Genesis: keep it if you might use that.',
    ]);
  });
});

describe('the browser graph file', () => {
  it('carries the flag, so personal verdicts and the sweep say the same in the browser', () => {
    const fromFile = createGraph(fromGraphFile(toGraphFile(graphWeapons())));
    for (const slug of ['torid', 'braton-prime', 'bolto']) {
      expect(fromFile.get(slug).incarnon).toBe(graph.get(slug).incarnon);
    }
  });

  // 50,000 since ranks joined the file (tiles show them): about 44,300 today, room for new weapons.
  it('stays small', () => {
    expect(JSON.stringify(toGraphFile(graphWeapons())).length).toBeLessThan(50_000);
  });
});
