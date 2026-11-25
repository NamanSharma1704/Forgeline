/**
 * The family tree's columns, captions and wire counts on a weapon page, against the real recipe
 * graph. Made from counts multiply down the chain (2 Bolto take 2 Lato); used to build counts are
 * each recipe's own.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { neededFor, treeColumns } from '../src/components/family-tree-columns';
import type { TileWeapon } from '../src/components/parts/ArsenalTile';
import type { WeaponIndex } from '../src/data/types';
import { createGraph, familyTree, type TreeNode } from '../src/engine';

const ROOT = path.resolve(import.meta.dirname, '..');
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'index.json'), 'utf8')) as WeaponIndex;
const graph = createGraph(index.weapons);
const bySlug = new Map(index.weapons.map((w) => [w.slug, w]));

const tile = (slug: string): TileWeapon => {
  const w = bySlug.get(slug)!;
  return { slug: w.slug, name: w.name, slot: w.slot, image: w.image, thumb: w.thumb, mr: w.masteryReq };
};
const labels = (generation: number) => `G${generation}`;

/** Each column as [name, caption] pairs, and each wire as "from>to ×copies". */
function columnsOf(slug: string, side: 'before' | 'after') {
  const tree = familyTree(graph, slug);
  const { columns, edges } = treeColumns(side === 'before' ? tree.madeFrom : tree.usedToBuild, side, {
    self: tile(slug),
    tile,
    labels,
  });
  return {
    columns: columns.map((c) => c.boxes.map((b) => [b.weapon.name, b.caption])),
    edges: edges.map((e) => `${e.from}>${e.to} ×${e.copies}`),
  };
}

describe('family tree captions', () => {
  it('words a count as ingredient, product and how many of the product', () => {
    expect(neededFor(2, 'Bolto', 'Akbolto')).toBe('2 Bolto needed for Akbolto');
    expect(neededFor(2, 'Lato', 'Bolto', 2)).toBe('2 Lato needed for 2 Bolto');
  });

  it('multiplies made from counts down the chain: Akbolto takes 2 Bolto, so 2 Lato', () => {
    const { columns, edges } = columnsOf('akbolto', 'before');
    expect(columns).toEqual([[['Bolto', '2 Bolto needed for Akbolto']], [['Lato', '2 Lato needed for 2 Bolto']]]);
    expect(edges).toEqual(['before-1-bolto>self ×2', 'before-2-lato>before-1-bolto ×2']);
  });

  it('carries the multiplier through three generations for Akjagara', () => {
    const { columns, edges } = columnsOf('akjagara', 'before');
    expect(columns).toEqual([
      [
        ['Akbolto', '1 Akbolto needed for Akjagara'],
        ['Dual Skana', '1 Dual Skana needed for Akjagara'],
      ],
      [['Bolto', '2 Bolto needed for Akbolto']],
      [['Lato', '2 Lato needed for 2 Bolto']],
    ]);
    expect(edges).toContain('before-3-lato>before-2-bolto ×2');
  });

  it('keeps each recipe’s own count on the used to build side', () => {
    const { columns, edges } = columnsOf('akbolto', 'after');
    expect(columns).toEqual([[['Akjagara', '1 Akbolto needed for Akjagara']]]);
    expect(edges).toEqual(['self>after-1-akjagara ×1']);

    const lato = columnsOf('lato', 'after').columns;
    expect(lato[0]).toEqual([['Bolto', '1 Lato needed for Bolto']]);
    expect(lato[1]).toContainEqual(['Akbolto', '2 Bolto needed for Akbolto']);
  });

  it('adds up a weapon reached along two branches and joins its captions', () => {
    // A diamond the live data does not have today: A takes 2 B and 1 C, and both B and C take D.
    const d: TreeNode = { slug: 'lato', copies: 3, status: null, children: [] };
    const roots: TreeNode[] = [
      { slug: 'bolto', copies: 2, status: null, children: [d] },
      { slug: 'hate', copies: 1, status: null, children: [{ ...d, copies: 1 }] },
    ];
    const { columns, edges } = treeColumns(roots, 'before', { self: tile('akbolto'), tile, labels });
    expect(columns[1]!.boxes).toHaveLength(1);
    expect(columns[1]!.boxes[0]!.caption).toBe('6 Lato needed for 2 Bolto, 1 Lato needed for Hate');
    expect(edges.filter((e) => e.from === 'before-2-lato').map((e) => e.copies)).toEqual([6, 1]);
  });
});
