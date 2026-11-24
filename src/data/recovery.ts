/**
 * Which weapons would be hard to get again (M6.5, 12.1), decided from what the source says about
 * where they come from (the index's `obtain`), and, where it says nothing, from a reviewed list and
 * the variant line.
 *
 * Easy, so no warning: anything the Market sells; a Prime whose relics still drop; anything with a
 * farmable source for every part. Hard: a vaulted Prime; a weapon with a part that only Cephalon
 * Simaris or the Stalker supplies. When the source is silent: the weapons in
 * data/fixtures/acquisition.json, each checked against its wiki page; then Vandal and Wraith weapons
 * (events and Invasions) and Prisma weapons (Baro Ki'Teer). Anything else the source is silent on
 * gets no warning rather than a guess.
 */

import acquisitionJson from '../../data/fixtures/acquisition.json';
import type { HardToGet } from '../engine/types';
import type { Weapon } from './types';
import { variantOf } from './variants';

interface ReviewedEntry {
  readonly kind: 'event' | 'baro' | 'quest' | 'only';
  readonly quest?: string;
  readonly once?: boolean;
  readonly from?: readonly ('simaris' | 'stalker')[];
  readonly simarisAfter?: string;
  readonly evidence: string;
}

/** The reviewed list, as data/fixtures/acquisition.json holds it. */
export const reviewedAcquisition = acquisitionJson as {
  readonly checked: string;
  readonly source: string;
  readonly weapons: Readonly<Record<string, ReviewedEntry>>;
};

function fromReviewed(entry: ReviewedEntry): HardToGet | null {
  switch (entry.kind) {
    case 'event':
    case 'baro':
      return { kind: entry.kind };
    case 'quest':
      return entry.quest ? { kind: 'quest', quest: entry.quest, ...(entry.once ? { once: true } : {}) } : null;
    case 'only':
      return entry.from?.length
        ? { kind: 'only', from: entry.from, ...(entry.simarisAfter ? { simarisAfter: entry.simarisAfter } : {}) }
        : null;
  }
}

export function hardToGetOf(weapon: Pick<Weapon, 'slug' | 'name' | 'obtain'>): HardToGet | null {
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
  // The source is silent from here on. A reviewed answer comes first, the variant rule after.
  const reviewed = obtain ? undefined : reviewedAcquisition.weapons[weapon.slug];
  if (reviewed) return fromReviewed(reviewed);
  const { variant } = variantOf(weapon.name);
  if (variant === 'event') return { kind: 'event' };
  if (variant === 'prisma') return { kind: 'baro' };
  return null;
}
