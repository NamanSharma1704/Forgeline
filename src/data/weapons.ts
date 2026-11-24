/**
 * Build-time access to the weapon index.
 *
 * The JSON is imported rather than fetched, so every page that uses it is pre-rendered with its
 * content baked in and the browser downloads no data to answer "what does Bolto build?". The search
 * box will need a trimmed copy at runtime; that is a separate, smaller file.
 */

import indexJson from '../../data/index.json';
import linksJson from '../../data/links.json';
import { listOf } from '../engine/explain';
import type { RecipeSummary } from './recipe';
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
 * A weapon's whole family, itself included: Braton, Braton Prime, Braton Vandal, Mk1-Braton. Normal
 * first, then in variant order, then by name.
 */
export const versionsOf = (slug: string): Weapon[] => {
  const weapon = bySlug.get(slug);
  if (!weapon) return [];
  return [...(byBase.get(variantOf(weapon.name).base) ?? [])].sort(
    (a, b) =>
      VARIANT_ORDER.indexOf(variantOf(a.name).variant) - VARIANT_ORDER.indexOf(variantOf(b.name).variant) ||
      a.name.localeCompare(b.name, 'en')
  );
};

/** The other versions of a weapon, in the same order. */
export const otherVersions = (slug: string): Weapon[] =>
  versionsOf(slug).filter((other) => other.slug !== slug);

/** Whether `from` is an ingredient, at any depth, of `to`. */
function reaches(from: string, to: string): boolean {
  const seen = new Set<string>();
  const queue = [from];
  while (queue.length) {
    for (const edge of resolve(queue.shift()!).usedToBuild) {
      if (edge.slug === to) return true;
      if (!seen.has(edge.slug)) {
        seen.add(edge.slug);
        queue.push(edge.slug);
      }
    }
  }
  return false;
}

/**
 * Where a recipe takes one exact version of this weapon (M6.5, 12.4). Recipes name a specific
 * weapon, so a Lex Prime does nothing for Aklex. Said both ways round:
 *
 *   on Lex Prime: "Aklex takes Lex, not Lex Prime."
 *   on Lex:       "Aklex needs Lex itself: Lex Prime does not count."
 *
 * Targets sharing the same versions are said in one sentence. Empty when no version of the weapon
 * is in a recipe.
 */
export function versionCallouts(slug: string): string[] {
  const weapon = bySlug.get(slug);
  const family = versionsOf(slug);
  if (!weapon || family.length < 2) return [];
  const siblings = otherVersions(slug);
  const usesOf = (target: string) => family.filter((w) => w.usedToBuild.some((e) => e.slug === target));
  const targets = [...new Set(family.flatMap((w) => w.usedToBuild.map((e) => e.slug)))].sort((a, b) =>
    resolve(a).name.localeCompare(resolve(b).name, 'en')
  );

  // Grouped by who the recipe does take (this weapon is not among them) or who it does not.
  const takesOthers = new Map<string, { names: string[]; targets: string[] }>();
  const needsThis = new Map<string, { names: string[]; targets: string[] }>();
  for (const target of targets) {
    // A weapon is never weighed against its own recipe (Mutalist Cernos is a Cernos version and is
    // built from Cernos), and "takes X, not this one" would mislead where this one leads there anyway.
    if (target === slug) continue;
    const users = usesOf(target);
    const usedHere = users.some((w) => w.slug === slug);
    if (!usedHere && reaches(slug, target)) continue;
    const group = usedHere
      ? {
          map: needsThis,
          names: siblings.filter((s) => s.slug !== target && !users.includes(s)).map((s) => s.name),
        }
      : { map: takesOthers, names: users.map((u) => u.name) };
    if (group.names.length === 0) continue;
    const key = group.names.join('|');
    const entry = group.map.get(key) ?? { names: group.names, targets: [] };
    entry.targets.push(resolve(target).name);
    group.map.set(key, entry);
  }

  const verb = (targets: string[], one: string, many: string) => (targets.length === 1 ? one : many);
  return [
    ...[...needsThis.values()].map(
      ({ names, targets: t }) =>
        `${listOf(t)} ${verb(t, 'needs', 'need')} ${weapon.name} itself: ${listOf(names)} ${names.length === 1 ? 'does' : 'do'} not count.`
    ),
    ...[...takesOthers.values()].map(
      ({ names, targets: t }) => `${listOf(t)} ${verb(t, 'takes', 'take')} ${listOf(names)}, not ${weapon.name}.`
    ),
  ];
}

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

const links = linksJson as { checkedAt: string; wiki: Record<string, string>; market: Record<string, string> };

/**
 * A weapon's pages on the Warframe wiki and warframe.market (M6.5, 12.8), from data/links.json,
 * which scripts/fetch-links.mjs checked against both sites. Absent when that check found none.
 */
export function communityLinksOf(slug: string): { wiki?: string; market?: string } {
  const title = links.wiki[slug];
  const item = links.market[slug];
  return {
    ...(title ? { wiki: `https://wiki.warframe.com/w/${encodeURIComponent(title.replace(/ /g, '_'))}` } : {}),
    ...(item ? { market: `https://warframe.market/items/${item}` } : {}),
  };
}

/** A weapon's recipe for display: names resolved, credits and Foundry time attached. */
export const recipeOf = (weapon: Weapon): RecipeSummary => ({
  slug: weapon.slug,
  name: weapon.name,
  weapons: weapon.madeFrom.map((edge) => ({ slug: edge.slug, name: resolve(edge.slug).name, copies: edge.copies })),
  materials: weapon.materials ?? [],
  ...(weapon.buildPrice ? { buildPrice: weapon.buildPrice } : {}),
  ...(weapon.blueprintPrice ? { blueprintPrice: weapon.blueprintPrice } : {}),
  ...(weapon.buildTime ? { buildTime: weapon.buildTime } : {}),
});

/** Weapons added since the previous monthly refresh, for the "New this month" strip. */
export const newWeapons = (): Weapon[] => index.weapons.filter((weapon) => weapon.isNew);
