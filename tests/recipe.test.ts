/**
 * Recipe details (M6.5, 12.7): credit costs in the index, the recipe summary the pages show, and
 * the rarity list, which is not in the source data, held to the names the source does have.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { DECAYING_RESOURCES, RARE_RESOURCES } from '../src/data/resources';
import { getWeapon, recipeOf } from '../src/data/weapons';
import { recipeCosts } from '../src/format/recipe';

const require = createRequire(import.meta.url);
const packageRoot = (() => {
  let dir = path.dirname(require.resolve('@wfcd/items'));
  while (!fs.existsSync(path.join(dir, 'package.json'))) dir = path.dirname(dir);
  return dir;
})();
// The index builder reads shared resources from these two files; Argon Crystal is in Misc.json.
const resources = ['Resources.json', 'Misc.json'].flatMap(
  (file) =>
    JSON.parse(fs.readFileSync(path.join(packageRoot, 'data', 'json', file), 'utf8')) as {
      name: string;
      description?: string;
    }[]
);

describe('what a build costs', () => {
  it('Akbolto: two Bolto, a Market blueprint, an Orokin Cell, credits and twelve hours', () => {
    const recipe = recipeOf(getWeapon('akbolto')!);
    expect(recipe.weapons).toEqual([{ slug: 'bolto', name: 'Bolto', copies: 2 }]);
    expect(recipe.materials.map((m) => m.name)).toContain('Orokin Cell');
    expect(recipe).toMatchObject({ buildPrice: 20000, blueprintPrice: 15000, buildTime: 43200 });
    expect(recipeCosts(recipe)).toEqual([
      '20,000 credits to build',
      '12 h in the Foundry',
      'blueprint 15,000 credits in the Market',
    ]);
  });

  it('leaves out what the data does not have', () => {
    const lex = recipeOf(getWeapon('lex')!);
    expect(lex.buildTime).toBeUndefined();
    expect(recipeCosts(lex).some((part) => part.includes('Foundry'))).toBe(false);
  });
});

describe('the rarity list', () => {
  const names = new Set(resources.map((r) => r.name));

  it('names only resources that exist in the source data', () => {
    for (const name of [...RARE_RESOURCES, ...DECAYING_RESOURCES]) expect(names).toContain(name);
  });

  it('marks as decaying only what the source itself says decays', () => {
    for (const name of DECAYING_RESOURCES) {
      expect(resources.find((r) => r.name === name)?.description).toMatch(/decays/i);
    }
  });
});
