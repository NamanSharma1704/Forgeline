/**
 * Which weapons would be hard to get again (M6.5, 12.1), decided from what the source says about
 * where they come from (the index's `obtain`), and, where it says nothing, from the variant line.
 *
 * Easy, so no warning: anything the Market sells; a Prime whose relics still drop; anything with a
 * farmable source for every part. Hard: a vaulted Prime; a weapon with a part that only Cephalon
 * Simaris or the Stalker supplies; and, when the source is silent, Vandal and Wraith weapons
 * (events and Invasions) and Prisma weapons (Baro Ki'Teer). Anything else the source is silent on
 * gets no warning rather than a guess: Paracesis and Skiajati, both quest rewards, are among them.
 */

import type { HardToGet } from '../engine/types';
import type { Weapon } from './types';
import { variantOf } from './variants';

export function hardToGetOf(weapon: Pick<Weapon, 'name' | 'obtain'>): HardToGet | null {
  const obtain = weapon.obtain;
  if (obtain?.market) return null;
  if (obtain?.vaulted === true) return { kind: 'vaulted' };
  if (obtain?.relics) return null;
  const from = (obtain?.onlyFrom ?? []).filter((source) => source === 'simaris' || source === 'stalker');
  if (from.length > 0) {
    return {
      kind: 'only',
      from,
      ...(from.includes('simaris') && obtain?.simarisAfter ? { simarisAfter: obtain.simarisAfter } : {}),
    };
  }
  if (obtain?.drops) return null;
  const { variant } = variantOf(weapon.name);
  if (variant === 'event') return { kind: 'event' };
  if (variant === 'prisma') return { kind: 'baro' };
  return null;
}
