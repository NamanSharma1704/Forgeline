import Link from 'next/link';
import { Icon } from './Icon';
import { WeaponArt, type ArtWeapon } from './WeaponArt';

/**
 * The family tree on a weapon page (spec 5.3): what it is made from, the weapon itself, and what it
 * is used to build, as picture boxes that open each weapon's page. Phase 1 shows one level each way;
 * a box whose weapon builds something further says so, which is the spec's "next step in the chain".
 *
 * Reads left to right on wide screens and top to bottom on phones.
 */

export interface TreeWeapon extends ArtWeapon {
  readonly slug: string;
  /** Names of what this weapon builds, for the "then" hint. */
  readonly builds: readonly string[];
}

export interface TreeEdge {
  readonly weapon: TreeWeapon;
  readonly copies: number;
}

function TreeBox({
  weapon,
  caption,
  then,
  self = false,
}: {
  weapon: TreeWeapon;
  caption?: string;
  then?: readonly string[];
  self?: boolean;
}) {
  const body = (
    <>
      <WeaponArt weapon={weapon} size="medium" />
      <span className="tree-box__name">{weapon.name}</span>
      {caption && <span className="tree-box__caption">{caption}</span>}
      {then && then.length > 0 && (
        <span className="tree-box__then">then {then.join(', ')}</span>
      )}
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

export function FamilyTree({
  self,
  madeFrom,
  usedToBuild,
}: {
  self: TreeWeapon;
  madeFrom: readonly TreeEdge[];
  usedToBuild: readonly TreeEdge[];
}) {
  return (
    <div className="tree">
      {madeFrom.length > 0 && (
        <>
          <div className="tree__group">
            <h3 className="tree__label">Made from</h3>
            <ul className="tree__boxes">
              {madeFrom.map(({ weapon, copies }) => (
                <li key={weapon.slug}>
                  <TreeBox weapon={weapon} caption={`${copies} needed`} />
                </li>
              ))}
            </ul>
          </div>
          <Connector />
        </>
      )}
      <div className="tree__group">
        <h3 className="tree__label">This weapon</h3>
        <TreeBox weapon={self} self />
      </div>
      {usedToBuild.length > 0 && (
        <>
          <Connector />
          <div className="tree__group">
            <h3 className="tree__label">Used to build</h3>
            <ul className="tree__boxes">
              {usedToBuild.map(({ weapon, copies }) => (
                <li key={weapon.slug}>
                  <TreeBox weapon={weapon} caption={`uses ${copies}`} then={weapon.builds} />
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
