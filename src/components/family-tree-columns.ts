/**
 * The family tree's columns and wires, flattened from the engine's tree (spec 5.3).
 *
 * Made from: every count is what it takes to build the weapon itself, so the counts multiply down
 * the chain. Akbolto takes 2 Bolto, each Bolto takes 1 Lato, so the Lato box reads "2 Lato needed
 * for 2 Bolto" and its wire carries 2.
 *
 * Used to build: each count is the recipe's own, one step at a time ("1 Akbolto needed for
 * Akjagara"), since those builds do not depend on how many of this weapon there are.
 *
 * A weapon reached along two branches (a diamond) appears once per column: its counts add up, its
 * captions are joined, and it gets a wire to each parent. Wires always run the way materials flow,
 * ingredient to product.
 */

import type { TreeNode } from '../engine/tree';
import type { TreeColumn, TreeEdge } from './FamilyTree';
import type { TileWeapon } from './parts/ArsenalTile';

/** The id of the weapon's own box in the tree, which every first-generation wire meets. */
export const SELF = 'self';

/** "2 Lato needed for 2 Bolto": the count, the ingredient, and how many of the product it makes. */
export function neededFor(copies: number, ingredient: string, product: string, products = 1): string {
  return `${copies} ${ingredient} needed for ${products > 1 ? `${products} ` : ''}${product}`;
}

interface Parent {
  readonly id: string;
  readonly name: string;
  /** Copies of this box it takes to build the weapon itself (made-from side only). */
  readonly total: number;
  readonly children: readonly TreeNode[];
}

export function treeColumns(
  roots: readonly TreeNode[],
  side: 'before' | 'after',
  {
    self,
    tile,
    labels,
  }: {
    /** The weapon the page is about. */
    self: TileWeapon;
    tile: (slug: string) => TileWeapon;
    labels: (generation: number) => string;
  }
): { columns: TreeColumn[]; edges: TreeEdge[] } {
  const columns: TreeColumn[] = [];
  const edges: TreeEdge[] = [];
  let frontier: Parent[] = [{ id: SELF, name: self.name, total: 1, children: roots }];

  for (let generation = 1; ; generation++) {
    const boxes = new Map<string, { id: string; weapon: TileWeapon; total: number; children: readonly TreeNode[]; captions: string[] }>();
    for (const parent of frontier) {
      for (const node of parent.children) {
        const id = `${side}-${generation}-${node.slug}`;
        const box = boxes.get(node.slug) ?? { id, weapon: tile(node.slug), total: 0, children: node.children, captions: [] };
        if (side === 'before') {
          // Enough for every copy of the parent the weapon needs.
          const copies = node.copies * parent.total;
          box.total += copies;
          box.captions.push(neededFor(copies, box.weapon.name, parent.name, parent.total));
          edges.push({ from: id, to: parent.id, copies, far: 'from' });
        } else {
          box.total = 1;
          box.captions.push(neededFor(node.copies, parent.name, box.weapon.name));
          edges.push({ from: parent.id, to: id, copies: node.copies, far: 'to' });
        }
        boxes.set(node.slug, box);
      }
    }
    if (boxes.size === 0) break;
    columns.push({
      label: labels(generation),
      boxes: [...boxes.values()].map(({ id, weapon, captions }) => ({ id, weapon, caption: captions.join(', ') })),
    });
    frontier = [...boxes.values()].map(({ id, weapon, total, children }) => ({ id, name: weapon.name, total, children }));
  }
  return { columns, edges };
}
