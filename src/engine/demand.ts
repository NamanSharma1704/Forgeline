/**
 * Demand arithmetic: how many copies of each weapon the player still needs.
 * Specified in docs/verdict-rules.md section 2.
 *
 *   masteryNeed(w)        = masteryDone(w) ? 0 : 1
 *   held(w)               = holds(w) ? qty(w) : 0
 *   consumedByChildren(w) = sum over p in usedToBuild(w) of copies(w -> p) x buildsNeeded(p)
 *   grossNeed(w)          = max(masteryNeed(w), consumedByChildren(w))
 *   buildsNeeded(w)       = max(0, grossNeed(w) - held(w))
 *
 * Three facts drive it. Recipes consume their weapon ingredients. Mastery is permanent and only
 * needs a copy in passing, so a copy can be levelled and then fed to a recipe: that is why grossNeed
 * takes the max rather than the sum. And copies already held reduce what still has to be built.
 *
 * One Demand is valid for one arsenal. Results are memoised, so evaluating every weapon (the slot
 * sweep, the property tests) costs one pass over the graph.
 */

import { heldCount, masteryDone, statusOf } from './status';
import type { Arsenal, RecipeGraph } from './types';

export interface Demand {
  /** How many more times the player has to build this weapon. */
  buildsNeeded(slug: string): number;
  /** Copies of this weapon that outstanding recipes will consume. The Keep number. */
  consumedByChildren(slug: string): number;
  /** Copies needed in total, before subtracting what the player holds. */
  grossNeed(slug: string): number;
}

export function createDemand(graph: RecipeGraph, arsenal: Arsenal): Demand {
  const consumedMemo = new Map<string, number>();
  const buildsMemo = new Map<string, number>();

  // The graph is acyclic by construction (see graph.ts), so plain memoised recursion terminates.
  const consumedByChildren = (slug: string): number => {
    const cached = consumedMemo.get(slug);
    if (cached !== undefined) return cached;
    let total = 0;
    for (const edge of graph.get(slug).usedToBuild) total += edge.copies * buildsNeeded(edge.slug);
    consumedMemo.set(slug, total);
    return total;
  };

  const grossNeed = (slug: string): number => {
    const masteryNeed = masteryDone(statusOf(arsenal, slug)) ? 0 : 1;
    return Math.max(masteryNeed, consumedByChildren(slug));
  };

  const buildsNeeded = (slug: string): number => {
    const cached = buildsMemo.get(slug);
    if (cached !== undefined) return cached;
    const value = Math.max(0, grossNeed(slug) - heldCount(arsenal, slug));
    buildsMemo.set(slug, value);
    return value;
  };

  return { buildsNeeded, consumedByChildren, grossNeed };
}
