/**
 * Quick setup (M6.5, 12.5): the 87 recipe weapons, a mastery-rank group at a time, so a new player
 * can make every verdict personal in a couple of minutes instead of facing 621 rows.
 *
 * It covers the 87, not only the 46 ingredients: an ingredient's verdict turns on whether the
 * weapons it builds are built and mastered, so those count as much as the ingredient itself.
 *
 * Grouped by mastery rank because that is how a player's arsenal is shaped: someone at rank 12 has
 * usually mastered nearly everything below rank 5, and can mark that whole group in one go.
 */

import type { OwnershipStatus } from '../data/types';

export interface SetupBand {
  readonly label: string;
  readonly min: number;
  readonly max: number;
}

export const SETUP_BANDS: readonly SetupBand[] = [
  { label: 'Mastery rank 0 to 4', min: 0, max: 4 },
  { label: 'Mastery rank 5 to 8', min: 5, max: 8 },
  { label: 'Mastery rank 9 and up', min: 9, max: Number.POSITIVE_INFINITY },
];

export interface SetupStep<T> {
  readonly label: string;
  /** By mastery rank, then name. */
  readonly rows: readonly T[];
}

/** The steps, in order; a band with no weapons is left out. */
export function setupSteps<T extends { readonly masteryReq: number; readonly name: string }>(
  rows: readonly T[]
): SetupStep<T>[] {
  return SETUP_BANDS.map((band) => ({
    label: band.label,
    rows: rows
      .filter((row) => row.masteryReq >= band.min && row.masteryReq <= band.max)
      .sort((a, b) => a.masteryReq - b.masteryReq || a.name.localeCompare(b.name, 'en')),
  })).filter((step) => step.rows.length > 0);
}

/** One tap moves a weapon on: Not owned, Owned, Mastered, Sold, and round again. */
export function nextStatus(status: OwnershipStatus): OwnershipStatus {
  switch (status) {
    case 'notOwned':
      return 'owned';
    case 'owned':
      return 'mastered';
    case 'mastered':
      return 'sold';
    case 'sold':
      return 'notOwned';
  }
}

/**
 * "All mastered" for a group: everything not yet mastered becomes mastered. Sold stays sold, since a
 * sold weapon was mastered and is simply no longer held. Returns only what changes.
 */
export function allMastered(
  slugs: readonly string[],
  statusOf: (slug: string) => OwnershipStatus
): Record<string, OwnershipStatus> {
  return Object.fromEntries(
    slugs
      .filter((slug) => statusOf(slug) === 'notOwned' || statusOf(slug) === 'owned')
      .map((slug) => [slug, 'mastered' as const])
  );
}
