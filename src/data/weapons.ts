/**
 * Build-time access to the weapon index.
 *
 * The JSON is imported rather than fetched, so every page that uses it is pre-rendered with its
 * content baked in and the browser downloads no data to answer "what does Bolto build?". The search
 * box will need a trimmed copy at runtime; that is a separate, smaller file.
 */

import indexJson from '../../data/index.json';
import type { Slot, Weapon, WeaponIndex } from './types';
import { VARIANT_ORDER, variantOf } from './variants';

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

const byBase = new Map<string, Weapon[]>();
for (const weapon of index.weapons) {
  const { base } = variantOf(weapon.name);
  byBase.set(base, [...(byBase.get(base) ?? []), weapon]);
}

/**
 * The other versions of a weapon: Braton gives Braton Prime, Braton Vandal and Mk1-Braton. Normal
 * first, then in variant order, then by name.
 */
export const otherVersions = (slug: string): Weapon[] => {
  const weapon = bySlug.get(slug);
  if (!weapon) return [];
  return (byBase.get(variantOf(weapon.name).base) ?? [])
    .filter((other) => other.slug !== slug)
    .sort(
      (a, b) =>
        VARIANT_ORDER.indexOf(variantOf(a.name).variant) - VARIANT_ORDER.indexOf(variantOf(b.name).variant) ||
        a.name.localeCompare(b.name, 'en')
    );
};

/** Weapons added since the previous monthly refresh, for the "New this month" strip. */
export const newWeapons = (): Weapon[] => index.weapons.filter((weapon) => weapon.isNew);
