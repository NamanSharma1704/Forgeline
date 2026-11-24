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

const genesisByBase = new Map<string, string>(
  index.weapons.flatMap((weapon) =>
    weapon.incarnonGenesis ? [[variantOf(weapon.name).base, weapon.incarnonGenesis] as const] : []
  )
);

/**
 * The Incarnon Genesis this weapon can take, or null. The adapter is made for one weapon, and the
 * wiki's Incarnon page says its versions can take it too: Prime, Vandal, Wraith, MK1, Prisma, Dex
 * and Syndicate. Akimbo and Dual weapons count as different weapons there, and the variant rules
 * already give them a base of their own (Aklato is not Lato), so they get nothing.
 */
export const incarnonGenesisOf = (weapon: Pick<Weapon, 'name' | 'incarnonGenesis'>): string | null =>
  weapon.incarnonGenesis ?? genesisByBase.get(variantOf(weapon.name).base) ?? null;

/** Every weapon as the recipe graph takes it, with the Incarnon Genesis it can take. */
export const graphWeapons = () =>
  index.weapons.map((weapon) => {
    const incarnon = incarnonGenesisOf(weapon);
    return incarnon ? { ...weapon, incarnon } : weapon;
  });

/** Weapons added since the previous monthly refresh, for the "New this month" strip. */
export const newWeapons = (): Weapon[] => index.weapons.filter((weapon) => weapon.isNew);
