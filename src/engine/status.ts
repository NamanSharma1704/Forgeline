/**
 * The four statuses are a 2x2 of possession and mastery (docs/verdict-rules.md section 1):
 *
 *               holds a copy   mastery done
 *   notOwned        no              no
 *   owned           yes             no
 *   mastered        yes             yes
 *   sold            no              yes
 *
 * Mastery is permanent, so `sold` counts as mastered for verdicts and as not held for possession.
 */

import type { Arsenal, ArsenalEntry, OwnershipStatus } from './types';

export const holds = (status: OwnershipStatus): boolean =>
  status === 'owned' || status === 'mastered';

export const masteryDone = (status: OwnershipStatus): boolean =>
  status === 'mastered' || status === 'sold';

export const entryOf = (arsenal: Arsenal, slug: string): ArsenalEntry | undefined =>
  Object.prototype.hasOwnProperty.call(arsenal, slug) ? arsenal[slug] : undefined;

export const statusOf = (arsenal: Arsenal, slug: string): OwnershipStatus =>
  entryOf(arsenal, slug)?.status ?? 'notOwned';

/** Whether the player recorded anything for this weapon, as opposed to the default being assumed. */
export const isRecorded = (arsenal: Arsenal, slug: string): boolean =>
  entryOf(arsenal, slug) !== undefined;

/**
 * Copies held. A held weapon counts as at least one even if a quantity of zero slipped through, since
 * "owned, zero copies" is a contradiction and the possession status is the stronger signal.
 */
export const heldCount = (arsenal: Arsenal, slug: string): number => {
  const entry = entryOf(arsenal, slug);
  if (!entry || !holds(entry.status)) return 0;
  const qty = entry.qty;
  return typeof qty === 'number' && Number.isFinite(qty) ? Math.max(1, Math.floor(qty)) : 1;
};

/**
 * Rule 2 of the decision order: until the player has recorded anything other than the default, every
 * status is a guess and the honest verdict for an ingredient is Check, not Keep.
 */
export const isArsenalSetUp = (arsenal: Arsenal): boolean =>
  Object.values(arsenal).some((entry) => entry !== undefined && entry.status !== 'notOwned');

/** Weapons give 100 mastery per rank. */
export const masteryFor = (maxRank: number): number => maxRank * 100;
