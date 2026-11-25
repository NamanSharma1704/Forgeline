import { Icon } from './Icon';
import type { TileWeapon } from './parts/ArsenalTile';
import { LiveTile } from './parts/LiveTile';
import { TreeWires } from './TreeWires';

/**
 * The family tree on a weapon page (spec 5.3) as a star chart (design plan 6.3): every generation it
 * is made from, the weapon itself framed in gold, and every generation it goes on to build, as
 * columns of Arsenal tiles that open each weapon's page. Each tile carries its mastery rank and,
 * once the arsenal is set up, the player's marks (owned, mastered, sold); under it, how it connects
 * to the column next to it ("2 Lato needed for 2 Bolto", "1 Akbolto needed for Akjagara"; the
 * counts are worked out in family-tree-columns.ts). The deepest chain in the data is
 * three steps each way, so at most seven columns; wide screens scroll sideways if they must,
 * phones read it top to bottom.
 *
 * On wide screens TreeWires draws the traces between tiles, gold where the player holds both ends;
 * the arrows stay as the fallback until it has, and on phones.
 */

export type TreeWeapon = TileWeapon;

export interface TreeBoxData {
  /** Unique within the tree: the same weapon can sit in two columns. */
  readonly id: string;
  readonly weapon: TileWeapon;
  readonly caption: string;
}

export interface TreeColumn {
  readonly label: string;
  readonly boxes: readonly TreeBoxData[];
}

/** One wire, from the ingredient's tile to the product's. */
export interface TreeEdge {
  readonly from: string;
  readonly to: string;
  readonly copies: number;
  /** The end away from the weapon itself, whose caption the count belongs to. */
  readonly far: 'from' | 'to';
}

function Node({ id, weapon, caption, self = false }: { id: string; weapon: TileWeapon; caption?: string; self?: boolean }) {
  return (
    <div className="star-node">
      <LiveTile weapon={weapon} href={self ? undefined : `/w/${weapon.slug}/`} selected={self} box={id} />
      {caption && <span className="star-node__caption">{caption}</span>}
    </div>
  );
}

function Connector() {
  return (
    <span className="tree__link" aria-hidden="true">
      <Icon name="arrow-right" className="tree__arrow tree__arrow--across" />
      <Icon name="arrow-down" className="tree__arrow tree__arrow--down" />
    </span>
  );
}

function Column({ column }: { column: TreeColumn }) {
  return (
    <div className="tree__group">
      <h3 className="tree__label">{column.label}</h3>
      <ul className="tree__boxes">
        {column.boxes.map((box) => (
          <li key={box.id}>
            <Node id={box.id} weapon={box.weapon} caption={box.caption} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FamilyTree({
  self,
  before,
  after,
  edges,
}: {
  self: TileWeapon;
  /** Generations it is made from, farthest first. */
  before: readonly TreeColumn[];
  /** Generations it builds, nearest first. */
  after: readonly TreeColumn[];
  /** Every wire between neighbouring columns; the weapon's own tile is "self". */
  edges: readonly TreeEdge[];
}) {
  return (
    <div className="tree-scroll">
      <TreeWires edges={edges}>
        {before.map((column) => (
          <div key={`before-${column.label}`} className="tree__step">
            <Column column={column} />
            <Connector />
          </div>
        ))}
        <div className="tree__group">
          <h3 className="tree__label">This weapon</h3>
          <Node id="self" weapon={self} self />
        </div>
        {after.map((column) => (
          <div key={`after-${column.label}`} className="tree__step">
            <Connector />
            <Column column={column} />
          </div>
        ))}
      </TreeWires>
    </div>
  );
}
