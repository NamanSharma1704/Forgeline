/**
 * The recipe graph as a compact static file (/graph.json), for the pages that run the engine in
 * the browser: personal verdicts, My Arsenal and the slot sweep. Generated at build time from the
 * same index as every page, so it cannot drift.
 *
 * Only the forward edges ship; the backward ones are derived on load.
 */

import type { GraphInput } from '../engine/graph';
import type { Slot, Weapon } from './types';

export interface GraphFileNode {
  /** slug */
  readonly s: string;
  /** name */
  readonly n: string;
  /** slot */
  readonly t: Slot;
  /** max rank */
  readonly r: number;
  /** used to build: [slug, copies] */
  readonly u?: readonly (readonly [string, number])[];
  /** the Incarnon Genesis it can take */
  readonly i?: string;
}

export function toGraphFile(
  weapons: readonly (Pick<Weapon, 'slug' | 'name' | 'slot' | 'maxRank' | 'usedToBuild'> & {
    readonly incarnon?: string;
  })[]
): GraphFileNode[] {
  return weapons.map((w) => ({
    s: w.slug,
    n: w.name,
    t: w.slot,
    r: w.maxRank,
    ...(w.usedToBuild.length ? { u: w.usedToBuild.map((e) => [e.slug, e.copies] as const) } : {}),
    ...(w.incarnon ? { i: w.incarnon } : {}),
  }));
}

export function fromGraphFile(nodes: readonly GraphFileNode[]): GraphInput[] {
  const madeFrom = new Map<string, { slug: string; copies: number }[]>();
  for (const node of nodes) {
    for (const [target, copies] of node.u ?? []) {
      madeFrom.set(target, [...(madeFrom.get(target) ?? []), { slug: node.s, copies }]);
    }
  }
  return nodes.map((node) => ({
    slug: node.s,
    name: node.n,
    maxRank: node.r,
    usedToBuild: (node.u ?? []).map(([slug, copies]) => ({ slug, copies })),
    madeFrom: madeFrom.get(node.s) ?? [],
    ...(node.i ? { incarnon: node.i } : {}),
  }));
}
