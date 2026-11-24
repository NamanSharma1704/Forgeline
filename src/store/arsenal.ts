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
 * only when it is more than one.
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

/** One entry as stored, or null when it is the default or not valid. */
function normaliseEntry(raw: unknown): StoredEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const { status, qty } = raw as { status?: unknown; qty?: unknown };
  if (!isStatus(status) || status === 'notOwned') return null;
  const count = held(status) ? clampQty(qty) : undefined;
  return count ? { status, qty: count } : { status };
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

/** Set one weapon's status. Not owned removes the entry; a held quantity survives owned/mastered. */
export function setStatus(
  arsenal: StoredArsenal,
  slug: string,
  status: OwnershipStatus,
  nowIso: string
): StoredArsenal {
  const entries = { ...arsenal.entries };
  const previous = entries[slug];
  if (status === 'notOwned') delete entries[slug];
  else {
    const keep = held(status) && previous?.qty ? { qty: previous.qty } : {};
    entries[slug] = { status, ...keep };
  }
  return { schema: ARSENAL_SCHEMA, updatedAt: nowIso, entries };
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
  const count = clampQty(qty);
  const entries = { ...arsenal.entries, [slug]: count ? { ...entry, qty: count } : { status: entry.status } };
  return { schema: ARSENAL_SCHEMA, updatedAt: nowIso, entries };
}

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
