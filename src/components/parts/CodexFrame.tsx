import { SLOT_LABEL } from '@/data/types';
import { Icon } from '../Icon';
import { WeaponArt } from '../WeaponArt';
import type { TileWeapon } from './ArsenalTile';
import { MasteredMark } from './MasteredMark';

/**
 * The Codex frame (design plan 11.2), which replaces the old pedestal: the weapon's art in a flat,
 * bracketed inspection frame over a faint blueprint crosshair, its slot (icon and word) top left,
 * its mastery rank top right, and the laurel in the corner once the player has mastered it. No
 * glow, no rings.
 */
export function CodexFrame({ weapon, priority = false }: { weapon: TileWeapon; priority?: boolean }) {
  return (
    <figure className="codex-frame shape shape--frame">
      <svg className="codex-frame__blueprint" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
        <circle cx="100" cy="100" r="74" />
        <circle cx="100" cy="100" r="44" />
        <path d="M100 6v188M6 100h188M30 30l140 140M170 30L30 170" />
      </svg>
      <span className="codex-frame__slot">
        <Icon name={weapon.slot} size={16} />
        {SLOT_LABEL[weapon.slot]}
      </span>
      <span className="codex-frame__mr">MR {weapon.mr}</span>
      <MasteredMark slug={weapon.slug} className="codex-frame__laurel" />
      <WeaponArt weapon={weapon} size="large" priority={priority} />
    </figure>
  );
}
