/**
 * The shape of data/index.json, written by scripts/build-index.mjs.
 * Changing anything here means bumping `schema` and updating the build script to match.
 */

export type Slot = 'primary' | 'secondary' | 'melee' | 'arch-gun' | 'arch-melee' | 'companion';

/** An edge in the recipe graph. `copies` is how many of the referenced weapon one build consumes. */
export interface RecipeEdge {
  slug: string;
  copies: number;
}

export interface Weapon {
  /** Route key: /w/<slug>. Stable across rebuilds. */
  slug: string;
  name: string;
  slot: Slot;
  masteryReq: number;
  /** Path relative to the site root, 256 px WebP. */
  image: string;
  /** Path relative to the site root, 96 px WebP, displayed at 48 px. */
  thumb: string;
  /** Upstream filename the art came from. Build-time only, never shown. */
  imageSource: string;
  /** Update that introduced the weapon, for example "Update 6.0" or "Vanilla". */
  introduced: string;
  introducedDate: string | null;
  /** Added since the previous monthly refresh. */
  isNew: boolean;
  /** Weapons this one is an ingredient for, with the copies each recipe consumes. */
  usedToBuild: RecipeEdge[];
  /** Weapon ingredients this one is built from. Resources are not tracked. */
  madeFrom: RecipeEdge[];
  /** Community shorthand folded into search. */
  aliases?: string[];
}

export interface WeaponIndex {
  schema: 1;
  generatedAt: string;
  /** @wfcd/items version the data was built from. */
  sourceVersion: string;
  /** Newest update that introduced a weapon. Not the game's current update. */
  newestWeaponUpdate: string;
  newestWeaponDate: string | null;
  counts: {
    weapons: number;
    /** Weapons that are an ingredient in at least one recipe. */
    ingredients: number;
    /** Weapons built from at least one other weapon. */
    craftable: number;
  };
  weapons: Weapon[];
}

/**
 * A player's status for one weapon. The four values are a 2x2 of possession and mastery:
 * see docs/verdict-rules.md section 1.
 */
export type OwnershipStatus = 'notOwned' | 'owned' | 'mastered' | 'sold';

export const SLOT_LABEL: Record<Slot, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  melee: 'Melee',
  'arch-gun': 'Arch-Gun',
  'arch-melee': 'Arch-Melee',
  companion: 'Companion weapon',
};
