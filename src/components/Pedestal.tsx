import type { Slot } from '@/data/types';
import { WeaponArt, type ArtWeapon } from './WeaponArt';

/**
 * The weapon's frame on its page: the picture in a flat, steel-edged chamfered panel. No halo and no
 * rings (design plan 2.2); Phase 3 turns this into the Codex frame with brackets, slot badge and MR.
 */

/** Slot families: the three loadout slots, and everything else as one. */
export function slotTone(slot: Slot): 'primary' | 'secondary' | 'melee' | 'other' {
  return slot === 'primary' || slot === 'secondary' || slot === 'melee' ? slot : 'other';
}

export function Pedestal({ weapon }: { weapon: ArtWeapon }) {
  return (
    <div className="pedestal shape" data-slot={slotTone(weapon.slot)}>
      <div className="pedestal__art">
        <WeaponArt weapon={weapon} size="large" priority />
      </div>
    </div>
  );
}
