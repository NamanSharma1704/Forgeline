import Link from 'next/link';
import { Icon } from './Icon';
import { StatusTag } from './StatusTag';
import { WeaponArt, type ArtWeapon } from './WeaponArt';

/**
 * The family tree on a weapon page (spec 5.3), at full depth: every generation it is made from, the
 * weapon itself, and every generation it goes on to build, as columns of picture boxes that open
 * each weapon's page. The deepest chain in the data is three steps each way, so at most seven
 * columns; wide screens scroll sideways if they must, phones read it top to bottom.
 *
 * Each box says how it connects to the column next to the weapon ("2 needed", "uses 1 Akbolto"),
 * and shows the player's status once their arsenal is set up.
 */

export interface TreeWeapon extends ArtWeapon {
  readonly slug: string;
}

export interface TreeBoxData {
  readonly weapon: TreeWeapon;
  readonly caption: string;
}

export interface TreeColumn {
  readonly label: string;
  readonly boxes: readonly TreeBoxData[];
}

function TreeBox({ weapon, caption, self = false }: { weapon: TreeWeapon; caption?: string; self?: boolean }) {
  const body = (
    <>
      <WeaponArt weapon={weapon} size="medium" />
      <span className="tree-box__name">{weapon.name}</span>
      {caption && <span className="tree-box__caption">{caption}</span>}
      <StatusTag slug={weapon.slug} />
    </>
  );
  if (self) {
    return (
      <div className="tree-box tree-box--self shape" aria-current="page">
        {body}
      </div>
    );
  }
  return (
    <Link href={`/w/${weapon.slug}/`} className="tree-box shape">
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
          <li key={box.weapon.slug}>
            <TreeBox weapon={box.weapon} caption={box.caption} />
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
}: {
  self: TreeWeapon;
  /** Generations it is made from, farthest first. */
  before: readonly TreeColumn[];
  /** Generations it builds, nearest first. */
  after: readonly TreeColumn[];
}) {
  return (
    <div className="tree-scroll">
      <div className="tree">
        {before.map((column) => (
          <div key={`before-${column.label}`} className="tree__step">
            <Column column={column} />
            <Connector />
          </div>
        ))}
        <div className="tree__group">
          <h3 className="tree__label">This weapon</h3>
          <TreeBox weapon={self} self />
        </div>
        {after.map((column) => (
          <div key={`after-${column.label}`} className="tree__step">
            <Connector />
            <Column column={column} />
          </div>
        ))}
      </div>
    </div>
  );
}
