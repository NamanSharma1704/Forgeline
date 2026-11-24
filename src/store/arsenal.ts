/**
 * The player's arsenal (spec 5.4): one status per weapon, plus how many copies they hold of an
 * ingredient. Saved in the browser, exported to and imported from a small file.
 *
 * Pure and immutable: every change returns a new arsenal. The React hook in useArsenal.ts owns the
 * storage and the subscriptions; this module owns the rules, so they are unit tested.
 *
 * Stored shape, versioned from day one (docs/spec-review.md gap 15) so a later change can migrate
 * an arsenal instead of silently losing it:
 *
 *   { schema: 1, updatedAt: "2026-11-24T...", entries: { bolto: { status: "mastered", qty: 2 } } }
 *
 * `notOwned` is the default and is never stored. `qty` is only kept while the weapon is held, and
 * only when it is more than one. `favourite: true` is only kept while the weapon is held.
 *
 * `favourite` arrived without a schema bump on purpose. It is optional, so older code reads an
 * arsenal that has it and simply ignores it. A bump would make an old tab, still open after a
 * deploy, refuse the stored arsenal, start empty, and risk writing that emptiness back.
 */

import type { OwnershipStatus } from '../data/types';
import type { Arsenal } from '../engine/types';

export const ARSENAL_STORAGE_KEY = 'forgeline-arsenal';
export const ARSENAL_SCHEMA = 1;
export const ARSENAL_FILE_KIND = 'forgeline-arsenal';
export const MAX_QTY = 99;

export interface StoredEntry {
  readonly status: Exclude<OwnershipStatus, 'notOwned'>;
  readonly qty?: number;
  readonly favourite?: true;
}

export interface StoredArsenal {
  readonly schema: typeof ARSENAL_SCHEMA;
  readonly updatedAt: string | null;
  readonly entries: Readonly<Record<string, StoredEntry>>;
}

export const EMPTY_ARSENAL: StoredArsenal = Object.freeze({
  schema: ARSENAL_SCHEMA,
  updatedAt: null,
  entries: Object.freeze({}),
});

export const STATUSES: readonly OwnershipStatus[] = ['notOwned', 'owned', 'mastered', 'sold'];

export const STATUS_LABEL: Record<OwnershipStatus, string> = {
  notOwned: 'Not owned',
  owned: 'Owned',
  mastered: 'Mastered',
  sold: 'Sold',
};

const isStatus = (value: unknown): value is OwnershipStatus =>
  typeof value === 'string' && (STATUSES as readonly string[]).includes(value);

const held = (status: OwnershipStatus) => status === 'owned' || status === 'mastered';

const clampQty = (qty: unknown): number | undefined => {
  if (typeof qty !== 'number' || !Number.isFinite(qty)) return undefined;
  const whole = Math.max(1, Math.min(MAX_QTY, Math.floor(qty)));
  return whole > 1 ? whole : undefined;
};

/** Build an entry from its parts, leaving out whatever is at its default. */
function entryOf(
  status: StoredEntry['status'],
  qty: number | undefined,
  favourite: boolean
): StoredEntry {
  const count = held(status) ? clampQty(qty) : undefined;
  return {
    status,
    ...(count ? { qty: count } : {}),
    ...(favourite && held(status) ? { favourite: true as const } : {}),
  };
}

/** One entry as stored, or null when it is the default or not valid. */
function normaliseEntry(raw: unknown): StoredEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const { status, qty, favourite } = raw as { status?: unknown; qty?: unknown; favourite?: unknown };
  if (!isStatus(status) || status === 'notOwned') return null;
  return entryOf(status, typeof qty === 'number' ? qty : undefined, favourite === true);
}

/** The problem with a file or stored value, phrased for the person who chose it. */
export class ArsenalFileError extends Error {}

export interface ParsedArsenal {
  readonly arsenal: StoredArsenal;
  /** Slugs the site does not know, dropped rather than kept as ghosts. */
  readonly unknown: readonly string[];
  /** Entries whose status or shape made no sense, dropped. */
  readonly invalid: number;
}

/**
 * Read an arsenal from storage or from an exported file. Accepts both shapes, migrates older
 * schemas, refuses anything newer than this build understands, and drops entries it cannot trust
 * instead of failing the whole file.
 */
export function parseArsenal(raw: unknown, knownSlugs?: ReadonlySet<string>): ParsedArsenal {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ArsenalFileError('This is not a Forgeline arsenal file.');
  }
  const data = raw as { kind?: unknown; schema?: unknown; entries?: unknown; updatedAt?: unknown };
  if (data.kind !== undefined && data.kind !== ARSENAL_FILE_KIND) {
    throw new ArsenalFileError('This is not a Forgeline arsenal file.');
  }
  if (typeof data.schema !== 'number') {
    throw new ArsenalFileError('This file is missing its version, so it cannot be read safely.');
  }
  if (data.schema > ARSENAL_SCHEMA) {
    throw new ArsenalFileError(
      'This file was saved by a newer version of Forgeline. Reload the page and try again.'
    );
  }
  // Migrations go here, oldest first, each lifting the data one schema. Schema 1 is the first.

  if (!data.entries || typeof data.entries !== 'object' || Array.isArray(data.entries)) {
    throw new ArsenalFileError('This file has no weapon list in it.');
  }

  const entries: Record<string, StoredEntry> = {};
  const unknown: string[] = [];
  let invalid = 0;
  for (const [slug, value] of Object.entries(data.entries as Record<string, unknown>)) {
    if (knownSlugs && !knownSlugs.has(slug)) {
      unknown.push(slug);
      continue;
    }
    const entry = normaliseEntry(value);
    if (entry) entries[slug] = entry;
    else if (!(value && typeof value === 'object' && (value as { status?: unknown }).status === 'notOwned')) {
      invalid++;
    }
  }

  return {
    arsenal: {
      schema: ARSENAL_SCHEMA,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
      entries,
    },
    unknown,
    invalid,
  };
}

/**
 * Set one weapon's status. Not owned removes the entry. A held quantity and the favourite mark
 * survive a move between owned and mastered, and are dropped once the weapon is sold.
 */
export function setStatus(
  arsenal: StoredArsenal,
  slug: string,
  status: OwnershipStatus,
  nowIso: string
): StoredArsenal {
  const entries = { ...arsenal.entries };
  const previous = entries[slug];
  if (status === 'notOwned') delete entries[slug];
  else entries[slug] = entryOf(status, previous?.qty, previous?.favourite === true);
  return { schema: ARSENAL_SCHEMA, updatedAt: nowIso, entries };
}

/** Set several statuses in one change, as setStatus would one at a time: one save, one update. */
export function setStatuses(
  arsenal: StoredArsenal,
  changes: Readonly<Record<string, OwnershipStatus>>,
  nowIso: string
): StoredArsenal {
  return Object.entries(changes).reduce(
    (next, [slug, status]) => setStatus(next, slug, status, nowIso),
    arsenal
  );
}

/** Set how many copies of a held weapon the player has. Ignored for weapons not held. */
export function setQty(
  arsenal: StoredArsenal,
  slug: string,
  qty: number,
  nowIso: string
): StoredArsenal {
  const entry = arsenal.entries[slug];
  if (!entry || !held(entry.status)) return arsenal;
  const entries = { ...arsenal.entries, [slug]: entryOf(entry.status, qty, entry.favourite === true) };
  return { schema: ARSENAL_SCHEMA, updatedAt: nowIso, entries };
}

/** Mark or unmark a held weapon as a favourite. Ignored for weapons not held. */
export function setFavourite(
  arsenal: StoredArsenal,
  slug: string,
  favourite: boolean,
  nowIso: string
): StoredArsenal {
  const entry = arsenal.entries[slug];
  if (!entry || !held(entry.status)) return arsenal;
  const entries = { ...arsenal.entries, [slug]: entryOf(entry.status, entry.qty, favourite) };
  return { schema: ARSENAL_SCHEMA, updatedAt: nowIso, entries };
}

export const favouriteIn = (arsenal: StoredArsenal, slug: string): boolean =>
  arsenal.entries[slug]?.favourite === true;

export const statusIn = (arsenal: StoredArsenal, slug: string): OwnershipStatus =>
  arsenal.entries[slug]?.status ?? 'notOwned';

export const qtyIn = (arsenal: StoredArsenal, slug: string): number => {
  const entry = arsenal.entries[slug];
  return entry && held(entry.status) ? (entry.qty ?? 1) : 0;
};

/** The engine reads the same entries; the shapes are compatible by design. */
export const toEngineArsenal = (arsenal: StoredArsenal): Arsenal => arsenal.entries;

/** Counts for the progress bar. Sold counts as mastered: mastery is permanent. */
export function tally(arsenal: StoredArsenal) {
  let owned = 0;
  let mastered = 0;
  let sold = 0;
  for (const entry of Object.values(arsenal.entries)) {
    if (entry.status === 'owned') owned++;
    else if (entry.status === 'mastered') mastered++;
    else if (entry.status === 'sold') sold++;
  }
  return { owned, mastered, sold, masteryDone: mastered + sold, recorded: owned + mastered + sold };
}

export const serialise = (arsenal: StoredArsenal): string => JSON.stringify(arsenal);

/** The export file: the stored arsenal plus a marker, so an unrelated JSON file is refused. */
export function exportFile(arsenal: StoredArsenal, nowIso: string): string {
  return `${JSON.stringify(
    {
      kind: ARSENAL_FILE_KIND,
      schema: ARSENAL_SCHEMA,
      exportedAt: nowIso,
      updatedAt: arsenal.updatedAt,
      entries: arsenal.entries,
    },
    null,
    2
  )}\n`;
}
