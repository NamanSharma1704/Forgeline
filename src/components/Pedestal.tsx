import type { Slot } from '@/data/types';
import { WeaponArt, type ArtWeapon } from './WeaponArt';

/**
 * The weapon on its holographic pedestal (design plan 4.2.1): the picture over a halo in its slot's
 * colour, standing on a drawn base of two lit rings. The colour comes from `data-slot`, so the
 * tokens decide it in both themes.
 */

/** Slot families for the accent colour: the three loadout slots, and everything else as one. */
export function slotTone(slot: Slot): 'primary' | 'secondary' | 'melee' | 'other' {
  return slot === 'primary' || slot === 'secondary' || slot === 'melee' ? slot : 'other';
}

export function Pedestal({ weapon }: { weapon: ArtWeapon }) {
  return (
    <div className="pedestal shape" data-slot={slotTone(weapon.slot)}>
      <div className="pedestal__art">
        <WeaponArt weapon={weapon} size="large" priority />
      </div>
      <svg className="pedestal__base" viewBox="0 0 240 36" aria-hidden="true" focusable="false">
        <ellipse className="pedestal__ring" cx="120" cy="16" rx="112" ry="13" />
        <ellipse className="pedestal__ring pedestal__ring--inner" cx="120" cy="16" rx="72" ry="7.5" />
        <path className="pedestal__tick" d="M8 16h10M222 16h10" />
      </svg>
    </div>
  );
}
