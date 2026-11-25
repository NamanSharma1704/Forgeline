import Link from 'next/link';
import { Icon, type IconName } from '../Icon';
import { WeaponArt, type ArtWeapon } from '../WeaponArt';

/**
 * A Foundry slot (design plan 11.4): one requirement of a recipe, as the game's Foundry shows it.
 * A square chamfered well with the item, its name, and the count: "have/need" when the site knows
 * what the player holds (weapons, from their arsenal), green when ready and red when short, always
 * with the number; "×need" when it does not (resources are not tracked, and the slot never pretends).
 */

const count = (n: number) => n.toLocaleString('en-GB');

export function FoundrySlot({
  name,
  need,
  have,
  art,
  icon = 'diamond',
  href,
}: {
  name: string;
  need: number;
  /** What the player holds, when the site knows. */
  have?: number;
  /** A weapon's picture; resources take `icon` instead. */
  art?: ArtWeapon;
  icon?: IconName;
  href?: string;
}) {
  const state = have === undefined ? 'neutral' : have >= need ? 'ready' : 'short';
  const body = (
    <>
      <span className="foundry-slot__well">
        {art ? <WeaponArt weapon={art} decorative /> : <Icon name={icon} size={22} />}
      </span>
      <span className="foundry-slot__name">{name}</span>
      <span className="foundry-slot__count">
        <span aria-hidden="true">{have === undefined ? `×${count(need)}` : `${count(have)}/${count(need)}`}</span>
        <span className="sr-only">
          {have === undefined
            ? `, ${count(need)} needed`
            : `, ${count(have)} of ${count(need)}, ${state === 'ready' ? 'ready' : 'short'}`}
        </span>
      </span>
    </>
  );
  return href ? (
    <Link href={href} className="foundry-slot shape" data-state={state}>
      {body}
    </Link>
  ) : (
    <div className="foundry-slot shape" data-state={state}>
      {body}
    </div>
  );
}
