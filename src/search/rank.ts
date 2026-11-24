/**
 * Weapon search: typo tolerant, Prime aware, pure. Runs in the browser over a small static index
 * (src/app/search-index.json/route.ts) and in tests over the real one.
 *
 * Ranking is tiered, because "what did they mean" has an order that a single fuzzy score blurs:
 *
 *   0  exact name or alias          "lex" -> Lex, "akbo" -> Akbolto
 *   1  name starts with the query   "lex" -> Lex Prime, after Lex because shorter names win a tier
 *   2  a word or alias starts with  "skana" -> Dual Skana
 *   3  name contains the query      "bolt" -> Akbolto
 *   4  one or two typos away        "bolot" -> Bolto (spec 5.1's own example)
 *   5  Fuse.js, for whatever is left
 *
 * Prime and non-Prime are separate entries with separate names, so "lex" never quietly resolves
 * to Lex Prime.
 */

import Fuse from 'fuse.js';
import type { Slot, Weapon } from '../data/types';

/** One searchable weapon. Short keys because this ships to the browser 621 times. */
export interface SearchEntry {
  /** slug */
  readonly s: string;
  /** display name */
  readonly n: string;
  /** slot */
  readonly t: Slot;
  /** how many recipes it feeds; zero when it is not an ingredient */
  readonly b: number;
  /** community shorthand */
  readonly a?: readonly string[];
}

export function toSearchEntries(
  weapons: readonly Pick<Weapon, 'slug' | 'name' | 'slot' | 'usedToBuild' | 'aliases'>[]
): SearchEntry[] {
  return weapons.map((weapon) => ({
    s: weapon.slug,
    n: weapon.name,
    t: weapon.slot,
    b: weapon.usedToBuild.length,
    ...(weapon.aliases?.length ? { a: weapon.aliases } : {}),
  }));
}

/** Lowercase, punctuation to spaces, collapsed: "Dark Split-Sword" -> "dark split sword". */
export const normalise = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Optimal string alignment distance: Levenshtein plus adjacent transpositions ("bolot"/"bolto"). */
export function editDistance(a: string, b: string, cap = 3): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, d[i - 2]![j - 2]! + 1);
      }
      d[i]![j] = best;
    }
  }
  return d[a.length]![b.length]!;
}

/** Typos allowed for a query of this length: none for very short ones, which would match anything. */
const typoBudget = (length: number) => (length < 4 ? 0 : length < 7 ? 1 : 2);

interface Prepared {
  readonly entry: SearchEntry;
  readonly name: string;
  readonly words: readonly string[];
  readonly aliases: readonly string[];
}

export type Searcher = (query: string, limit?: number) => SearchEntry[];

export function createSearcher(entries: readonly SearchEntry[]): Searcher {
  const prepared: Prepared[] = entries.map((entry) => {
    const name = normalise(entry.n);
    return { entry, name, words: name.split(' '), aliases: (entry.a ?? []).map(normalise) };
  });
  const fuse = new Fuse(entries as SearchEntry[], {
    keys: [
      { name: 'n', weight: 2 },
      { name: 'a', weight: 1 },
    ],
    threshold: 0.35,
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 2,
  });

  return (query, limit = 8) => {
    const q = normalise(query);
    if (!q) return [];
    const budget = typoBudget(q.length);
    const ranked = new Map<string, { entry: SearchEntry; tier: number; weight: number }>();
    const offer = (entry: SearchEntry, tier: number, weight: number) => {
      const current = ranked.get(entry.s);
      if (!current || tier < current.tier || (tier === current.tier && weight < current.weight)) {
        ranked.set(entry.s, { entry, tier, weight });
      }
    };

    for (const { entry, name, words, aliases } of prepared) {
      if (name === q || aliases.includes(q)) offer(entry, 0, name.length);
      else if (name.startsWith(`${q} `)) {
        // A whole-word prefix ("bo" -> "bo prime") is the query's own variant: rank it ahead of
        // names that merely start with the same letters ("boar", "bolto").
        offer(entry, 1, name.length - 1000);
      } else if (name.startsWith(q)) offer(entry, 1, name.length);
      else if (words.some((w) => w.startsWith(q)) || aliases.some((a) => a.startsWith(q))) {
        offer(entry, 2, name.length);
      } else if (name.includes(q)) offer(entry, 3, name.length);
      else if (budget > 0) {
        // Compare against whole words and against same-length word prefixes, so "bolot" finds
        // "bolto" and "akbolo" finds "akbolto" while the player is still typing.
        let best = Number.POSITIVE_INFINITY;
        for (const candidate of [name, ...words, ...aliases]) {
          best = Math.min(best, editDistance(q, candidate, budget));
          if (candidate.length > q.length) {
            best = Math.min(best, editDistance(q, candidate.slice(0, q.length), budget));
          }
        }
        if (best <= budget) offer(entry, 4, best * 100 + name.length);
      }
    }

    if (ranked.size < limit) {
      for (const result of fuse.search(q, { limit: limit * 2 })) {
        offer(result.item, 5, result.score ?? 1);
      }
    }

    return [...ranked.values()]
      .sort((a, b) => a.tier - b.tier || a.weight - b.weight || a.entry.n.localeCompare(b.entry.n))
      .slice(0, limit)
      .map((r) => r.entry);
  };
}
