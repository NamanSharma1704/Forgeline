/**
 * The recipe graph as a compact static file (/graph.json), for the pages that run the engine in
 * the browser: personal verdicts, My Arsenal and the slot sweep. Generated at build time from the
 * same index as every page, so it cannot drift.
 *
 * Only the forward edges ship; the backward ones are derived on load.
 */

import type { GraphInput } from '../engine/graph';
import type { HardToGet } from '../engine/types';
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
  /** why it would be hard to get again: see encodeHard */
  readonly h?: string;
}

/**
 * HardToGet in a few characters: "vaulted", "event", "baro", "only:simaris+stalker" with the
 * Simaris condition after a second colon ("only:simaris:Complete The New War"), or
 * "quest:1:The Sacrifice" (1 when replaying it gives no second one).
 */
export function encodeHard(hard: HardToGet): string {
  if (hard.kind === 'quest') return `quest:${hard.once ? 1 : 0}:${hard.quest}`;
  if (hard.kind !== 'only') return hard.kind;
  return `only:${hard.from.join('+')}${hard.simarisAfter ? `:${hard.simarisAfter}` : ''}`;
}

export function decodeHard(code: string): HardToGet | null {
  if (code === 'vaulted' || code === 'event' || code === 'baro') return { kind: code };
  const quest = /^quest:([01]):(.+)$/.exec(code);
  if (quest) return { kind: 'quest', quest: quest[2]!, ...(quest[1] === '1' ? { once: true } : {}) };
  const match = /^only:([a-z+]+)(?::(.*))?$/.exec(code);
  if (!match) return null;
  const from = match[1]!
    .split('+')
    .filter((source): source is 'simaris' | 'stalker' => source === 'simaris' || source === 'stalker');
  return { kind: 'only', from, ...(match[2] ? { simarisAfter: match[2] } : {}) };
}

export function toGraphFile(
  weapons: readonly (Pick<Weapon, 'slug' | 'name' | 'slot' | 'maxRank' | 'usedToBuild'> & {
    readonly incarnon?: string;
    readonly hardToGet?: HardToGet;
  })[]
): GraphFileNode[] {
  return weapons.map((w) => ({
    s: w.slug,
    n: w.name,
    t: w.slot,
    r: w.maxRank,
    ...(w.usedToBuild.length ? { u: w.usedToBuild.map((e) => [e.slug, e.copies] as const) } : {}),
    ...(w.incarnon ? { i: w.incarnon } : {}),
    ...(w.hardToGet ? { h: encodeHard(w.hardToGet) } : {}),
  }));
}

export function fromGraphFile(nodes: readonly GraphFileNode[]): GraphInput[] {
  const madeFrom = new Map<string, { slug: string; copies: number }[]>();
  for (const node of nodes) {
    for (const [target, copies] of node.u ?? []) {
      madeFrom.set(target, [...(madeFrom.get(target) ?? []), { slug: node.s, copies }]);
    }
  }
  return nodes.map((node) => {
    const hardToGet = node.h ? decodeHard(node.h) : null;
    return {
      slug: node.s,
      name: node.n,
      maxRank: node.r,
      usedToBuild: (node.u ?? []).map(([slug, copies]) => ({ slug, copies })),
      madeFrom: madeFrom.get(node.s) ?? [],
      ...(node.i ? { incarnon: node.i } : {}),
      ...(hardToGet ? { hardToGet } : {}),
    };
  });
}
