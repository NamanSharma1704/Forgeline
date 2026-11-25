import Link from 'next/link';
import { Icon } from './Icon';
import { StatusRing, StatusTag } from './StatusTag';
import { TreeWires } from './TreeWires';
import { WeaponArt, type ArtWeapon } from './WeaponArt';

/**
 * The family tree on a weapon page (spec 5.3), drawn as the Foundry schematic (design plan 4.4):
 * every generation it is made from, the weapon itself in gold, and every generation it goes on to
 * build, as columns of boxes that open each weapon's page. The deepest chain in the data is three
 * steps each way, so at most seven columns; wide screens scroll sideways if they must, phones read
 * it top to bottom.
 *
 * Each box carries its mastery rank, says how it connects to the column next to the weapon
 * ("2 needed", "uses 1 Akbolto"), and rings its picture with the player's status once their arsenal
 * is set up. On wide screens TreeWires draws the circuit between the boxes; the arrows stay as the
 * fallback until it has, and on phones.
 */

export interface TreeWeapon extends ArtWeapon {
  readonly slug: string;
  /** Mastery rank needed to build it. */
  readonly mr: number;
}

export interface TreeBoxData {
  /** Unique within the tree: the same weapon can sit in two columns. */
  readonly id: string;
  readonly weapon: TreeWeapon;
  readonly caption: string;
}

export interface TreeColumn {
  readonly label: string;
  readonly boxes: readonly TreeBoxData[];
}

/** One wire, from the ingredient's box to the product's. */
export interface TreeEdge {
  readonly from: string;
  readonly to: string;
  readonly copies: number;
  /** The end away from the weapon itself, whose caption the count belongs to. */
  readonly far: 'from' | 'to';
}

function TreeBox({
  id,
  weapon,
  caption,
  self = false,
}: {
  id: string;
  weapon: TreeWeapon;
  caption?: string;
  self?: boolean;
}) {
  const body = (
    <>
      <span className="tree-box__mr">MR {weapon.mr}</span>
      <span className="tree-box__art">
        <WeaponArt weapon={weapon} size="medium" />
        <StatusRing slug={weapon.slug} />
      </span>
      <span className="tree-box__name">{weapon.name}</span>
      {caption && <span className="tree-box__caption">{caption}</span>}
      <StatusTag slug={weapon.slug} />
    </>
  );
  if (self) {
    return (
      <div className="tree-box tree-box--self shape" aria-current="page" data-box={id}>
        {body}
      </div>
    );
  }
  return (
    <Link href={`/w/${weapon.slug}/`} className="tree-box shape" data-box={id}>
      {body}
    </Link>
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
            <TreeBox id={box.id} weapon={box.weapon} caption={box.caption} />
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
  self: TreeWeapon;
  /** Generations it is made from, farthest first. */
  before: readonly TreeColumn[];
  /** Generations it builds, nearest first. */
  after: readonly TreeColumn[];
  /** Every wire between neighbouring columns; the weapon's own box is "self". */
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
          <TreeBox id="self" weapon={self} self />
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
