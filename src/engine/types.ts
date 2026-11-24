/**
 * Types shared by the verdict engine. The engine is pure: no React, no I/O, no globals. It takes a
 * recipe graph and a player's arsenal and returns data; the UI decides how to show it.
 *
 * The rules these types serve are specified in docs/verdict-rules.md.
 */

import type { OwnershipStatus, RecipeEdge } from '../data/types';

export type { OwnershipStatus, RecipeEdge };

/** One weapon as the engine sees it: only what the arithmetic and the explanations need. */
/**
 * Why a weapon would be hard to get again (M6.5, 12.1). Never changes a verdict: a weapon that
 * builds nothing is still Safe for recipes. It is said alongside, so a player thinks twice.
 */
export type HardToGet =
  | { readonly kind: 'vaulted' }
  | {
      readonly kind: 'only';
      readonly from: readonly ('simaris' | 'stalker')[];
      /** Cephalon Simaris's condition, when Simaris is one of them. */
      readonly simarisAfter?: string;
    }
  | { readonly kind: 'event' }
  | { readonly kind: 'baro' };

export interface GraphNode {
  readonly slug: string;
  readonly name: string;
  readonly maxRank: number;
  readonly usedToBuild: readonly RecipeEdge[];
  readonly madeFrom: readonly RecipeEdge[];
  /** The Incarnon Genesis it can take, or null. Never changes a verdict; it is said alongside. */
  readonly incarnon: string | null;
  /** Why it would be hard to get again, or null. Never changes a verdict either. */
  readonly hardToGet: HardToGet | null;
}

/**
 * The recipe graph, guaranteed acyclic. Construction drops any edge that would close a loop and
 * records why in `warnings`, so every walk over it terminates.
 */
export interface RecipeGraph {
  readonly nodes: ReadonlyMap<string, GraphNode>;
  readonly warnings: readonly string[];
  has(slug: string): boolean;
  /** Throws on an unknown slug: the build validates every reference, so this is a programming error. */
  get(slug: string): GraphNode;
}

/**
 * What the player recorded for one weapon. `qty` only matters while they hold it. `favourite` marks
 * a weapon they have invested in (a Catalyst, Forma, an Exilus Adapter): the sweep never suggests
 * selling it, whatever recipes say.
 */
export interface ArsenalEntry {
  readonly status: OwnershipStatus;
  readonly qty?: number;
  readonly favourite?: boolean;
}

/**
 * The player's arsenal, keyed by slug. A missing entry means `notOwned`. The store removes an entry
 * when it is set back to `notOwned`, but the engine does not rely on that.
 */
export type Arsenal = Readonly<Record<string, ArsenalEntry | undefined>>;

// ---------------------------------------------------------------- verdicts

/** Why a recipe target does or does not hold on to copies of the weapon being checked. */
export type TargetReason =
  /** Not owned and not mastered: it still has to be built at least once. */
  | 'needs-building'
  /** Its own mastery is covered, but something further down the chain still needs copies of it. */
  | 'feeds-chain'
  /** Mastered, and nothing below it is outstanding. */
  | 'mastered'
  /** Held but not levelled. Nothing needs another copy, but the player should level it first. */
  | 'held-unmastered';

/** One line on the result card: a weapon that the checked weapon is an ingredient for. */
export interface TargetLine {
  readonly slug: string;
  /** Copies of the checked weapon one build of this target consumes. */
  readonly copiesPerBuild: number;
  /** How many more times the player still has to build this target. */
  readonly buildsNeeded: number;
  /** copiesPerBuild x buildsNeeded: this line's share of the Keep number. */
  readonly copiesNeeded: number;
  readonly status: OwnershipStatus;
  /** True when the player has not recorded a status for this weapon, so `notOwned` was assumed. */
  readonly statusAssumed: boolean;
  readonly reason: TargetReason;
  /**
   * Paths from this target down to the weapons that are still outstanding, target first. Empty when
   * nothing below the target is outstanding. Example for Lato's Bolto line with nothing owned:
   * [["bolto","akbolto","akjagara"], ["bolto","hystrix"]].
   */
  readonly chains: readonly (readonly string[])[];
}

/** A target as shown before the player has set up their arsenal: no statuses, so no arithmetic. */
export interface CheckTarget {
  readonly slug: string;
  readonly copies: number;
  /** Every forward path from this target, target first. Empty when the target builds nothing. */
  readonly chains: readonly (readonly string[])[];
}

/**
 * The note about the checked weapon's own mastery, which applies whatever the recipe verdict is.
 * Selling a weapon before levelling it is the most common real mistake, ingredient or not.
 */
export type MasteryNote =
  /** Held and not yet mastered. */
  | { readonly kind: 'unmastered'; readonly maxRank: number; readonly mastery: number }
  /** Status unknown. They are selling it, so they hold one, but we cannot tell if it is levelled. */
  | { readonly kind: 'maybe-unmastered'; readonly maxRank: number; readonly mastery: number };

interface VerdictBase {
  readonly slug: string;
  /** Null once the weapon is mastered or sold. */
  readonly mastery: MasteryNote | null;
}

export type SafeBasis =
  /** Rule 1: it builds nothing. */
  | 'not-an-ingredient'
  /** Rule 3: every weapon it builds is mastered, and nothing further down needs a copy. */
  | 'all-mastered'
  /** Rule 4: nothing needs a copy, but the player holds something it built that is not levelled. */
  | 'targets-held'
  /** Copies are needed, but the player holds more than that. */
  | 'surplus';

export interface SafeVerdict extends VerdictBase {
  readonly kind: 'safe';
  readonly basis: SafeBasis;
  /** The "safe, but" banner: true for `targets-held`. */
  readonly soft: boolean;
  /** Copies still needed. Zero except for `surplus`. */
  readonly keep: number;
  /** Copies the player holds. */
  readonly have: number;
  readonly targets: readonly TargetLine[];
}

export interface CheckVerdict extends VerdictBase {
  readonly kind: 'check';
  readonly targets: readonly CheckTarget[];
  /**
   * Copies needed if none of the recipes it feeds have been built yet: the Keep number a player who
   * owns nothing downstream would see. Lets a Check still say something concrete before the arsenal
   * exists, e.g. Lato needs 3 because Bolto feeds Akbolto and Hystrix.
   */
  readonly keepIfNothingBuilt: number;
}

export interface KeepVerdict extends VerdictBase {
  readonly kind: 'keep';
  /** Total copies outstanding recipes will consume. The headline number. */
  readonly keep: number;
  /** Copies the player holds, zero when they have not said. */
  readonly have: number;
  /** Every target, satisfied or not, so the card can show every reason. */
  readonly targets: readonly TargetLine[];
}

export type Verdict = SafeVerdict | CheckVerdict | KeepVerdict;
