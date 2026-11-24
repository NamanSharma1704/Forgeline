/**
 * Builds the engine's view of the recipe graph from the weapon index.
 *
 * The real data has no cycles and a maximum chain depth of 3, but the engine must never hang on a
 * future recipe that loops. So construction walks the graph once, depth first in a fixed order, and
 * drops any edge that would close a loop (and its mirror in `madeFrom`), recording a warning. Every
 * later walk is then over a DAG and needs no guards of its own. Unknown references are dropped the
 * same way.
 */

import type { GraphNode, RecipeEdge, RecipeGraph } from './types';

export interface GraphInput {
  readonly slug: string;
  readonly name: string;
  readonly maxRank?: number;
  readonly usedToBuild: readonly RecipeEdge[];
  readonly madeFrom: readonly RecipeEdge[];
}

const bySlug = (a: RecipeEdge, b: RecipeEdge) => a.slug.localeCompare(b.slug, 'en');

export function createGraph(weapons: readonly GraphInput[]): RecipeGraph {
  const warnings: string[] = [];
  const known = new Set(weapons.map((weapon) => weapon.slug));

  // Mutable working copies, so dropped edges never leak back into the caller's data.
  const forward = new Map<string, RecipeEdge[]>();
  const backward = new Map<string, RecipeEdge[]>();
  for (const weapon of weapons) {
    const keep = (edges: readonly RecipeEdge[], direction: string) =>
      edges.filter((edge) => {
        if (known.has(edge.slug)) return true;
        warnings.push(`${weapon.slug} ${direction} unknown weapon ${edge.slug}; edge dropped`);
        return false;
      });
    forward.set(weapon.slug, [...keep(weapon.usedToBuild, 'is used to build')].sort(bySlug));
    backward.set(weapon.slug, [...keep(weapon.madeFrom, 'is made from')].sort(bySlug));
  }

  // Depth-first colouring over usedToBuild. A grey target means the edge closes a loop.
  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const colour = new Map<string, number>();
  const dropped: [from: string, to: string][] = [];

  const visit = (slug: string) => {
    colour.set(slug, GREY);
    for (const edge of forward.get(slug) ?? []) {
      const state = colour.get(edge.slug) ?? WHITE;
      if (state === GREY) dropped.push([slug, edge.slug]);
      else if (state === WHITE) visit(edge.slug);
    }
    colour.set(slug, BLACK);
  };
  for (const slug of [...known].sort((a, b) => a.localeCompare(b, 'en'))) {
    if ((colour.get(slug) ?? WHITE) === WHITE) visit(slug);
  }

  for (const [from, to] of dropped) {
    forward.set(from, (forward.get(from) ?? []).filter((edge) => edge.slug !== to));
    backward.set(to, (backward.get(to) ?? []).filter((edge) => edge.slug !== from));
    warnings.push(`recipe cycle: ${from} -> ${to} closes a loop; edge dropped`);
  }

  const nodes = new Map<string, GraphNode>();
  for (const weapon of weapons) {
    nodes.set(weapon.slug, {
      slug: weapon.slug,
      name: weapon.name,
      maxRank: weapon.maxRank ?? 30,
      usedToBuild: Object.freeze(forward.get(weapon.slug) ?? []),
      madeFrom: Object.freeze(backward.get(weapon.slug) ?? []),
    });
  }

  return {
    nodes,
    warnings: Object.freeze(warnings),
    has: (slug) => nodes.has(slug),
    get: (slug) => {
      const node = nodes.get(slug);
      if (!node) throw new Error(`unknown weapon: ${slug}`);
      return node;
    },
  };
}
