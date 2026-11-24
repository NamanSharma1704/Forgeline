/**
 * Build-time access to the weapon index.
 *
 * The JSON is imported rather than fetched, so every page that uses it is pre-rendered with its
 * content baked in and the browser downloads no data to answer "what does Bolto build?". The search
 * box will need a trimmed copy at runtime; that is a separate, smaller file.
 */

import indexJson from '../../data/index.json';
import type { Slot, Weapon, WeaponIndex } from './types';

const index = indexJson as unknown as WeaponIndex;

const bySlug = new Map<string, Weapon>(index.weapons.map((weapon) => [weapon.slug, weapon]));

export const weaponIndex = index;

export const allWeapons = (): Weapon[] => index.weapons;

export const getWeapon = (slug: string): Weapon | undefined => bySlug.get(slug);

/** Weapons that are an ingredient in at least one recipe: the 46 that matter for a sell check. */
export const ingredientWeapons = (): Weapon[] =>
  index.weapons.filter((weapon) => weapon.usedToBuild.length > 0);

export const weaponsInSlot = (slot: Slot): Weapon[] =>
  index.weapons.filter((weapon) => weapon.slot === slot);

/** Resolve an edge to the weapon it points at. The build validates that this never returns null. */
export const resolve = (slug: string): Weapon => {
  const weapon = bySlug.get(slug);
  if (!weapon) throw new Error(`index references a missing weapon: ${slug}`);
  return weapon;
};

/**
 * Forward chain from a weapon, breadth first, for the family tree. The deepest chain in the current
 * data is three steps (Lato, Bolto, Akbolto, Akjagara), so depth is bounded in practice. The guard
 * is here for a future recipe that loops.
 */
export const forwardChain = (slug: string, maxDepth = 6): Weapon[][] => {
  const levels: Weapon[][] = [];
  const seen = new Set<string>([slug]);
  let frontier = resolve(slug).usedToBuild.map((edge) => edge.slug);
  while (frontier.length > 0 && levels.length < maxDepth) {
    const level = frontier.filter((next) => !seen.has(next));
    if (level.length === 0) break;
    for (const next of level) seen.add(next);
    levels.push(level.map(resolve));
    frontier = level.flatMap((next) => resolve(next).usedToBuild.map((edge) => edge.slug));
  }
  return levels;
};
