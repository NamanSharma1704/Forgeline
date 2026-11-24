/**
 * The family tree for a weapon page (spec 5.3): backwards to what it is made from, forwards to what
 * it builds, each box carrying the copy count and, once the arsenal is set up, the player's status.
 *
 * Phase 1 shows one level, phase 2 the full depth. The deepest chain in the data is three steps, so
 * full depth is cheap. The graph is acyclic by construction, so the walk always terminates; a weapon
 * reachable along two branches (a diamond) simply appears under both.
 */

import { isArsenalSetUp, statusOf } from './status';
import type { Arsenal, OwnershipStatus, RecipeEdge, RecipeGraph } from './types';

export interface TreeNode {
  readonly slug: string;
  /** Copies on the edge into this box: how many this recipe consumes or needs. */
  readonly copies: number;
  /** Null until the arsenal is set up, so the tree does not show a wall of guessed "Not owned". */
  readonly status: OwnershipStatus | null;
  readonly children: readonly TreeNode[];
}

export interface FamilyTree {
  readonly slug: string;
  readonly status: OwnershipStatus | null;
  /** Ingredients, then their ingredients. */
  readonly madeFrom: readonly TreeNode[];
  /** What it builds, then what those build. */
  readonly usedToBuild: readonly TreeNode[];
  /** True when `depth` cut off branches that exist, so the UI can offer "show the full tree". */
  readonly truncated: boolean;
}

export interface TreeOptions {
  /** Player statuses. Omit, or pass an empty arsenal, for a tree with no statuses. */
  readonly arsenal?: Arsenal;
  /** Levels to show in each direction. Defaults to the full depth. */
  readonly depth?: number;
}

export function familyTree(
  graph: RecipeGraph,
  slug: string,
  { arsenal = {}, depth = Number.POSITIVE_INFINITY }: TreeOptions = {}
): FamilyTree {
  const showStatus = isArsenalSetUp(arsenal);
  const status = (s: string) => (showStatus ? statusOf(arsenal, s) : null);
  let truncated = false;

  const grow = (
    edges: readonly RecipeEdge[],
    level: number,
    next: (s: string) => readonly RecipeEdge[]
  ): TreeNode[] =>
    edges.map((edge) => {
      const below = next(edge.slug);
      let children: TreeNode[] = [];
      if (level < depth) children = grow(below, level + 1, next);
      else if (below.length > 0) truncated = true;
      return { slug: edge.slug, copies: edge.copies, status: status(edge.slug), children };
    });

  const root = graph.get(slug);
  const madeFrom = depth >= 1 ? grow(root.madeFrom, 1, (s) => graph.get(s).madeFrom) : [];
  const usedToBuild = depth >= 1 ? grow(root.usedToBuild, 1, (s) => graph.get(s).usedToBuild) : [];
  if (depth < 1 && (root.madeFrom.length > 0 || root.usedToBuild.length > 0)) truncated = true;

  return { slug, status: status(slug), madeFrom, usedToBuild, truncated };
}
