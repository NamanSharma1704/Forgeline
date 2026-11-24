/** Types for scripts/lib/refresh.mjs, so the tests can import it under strict TypeScript. */

import type { WeaponIndex } from '../../src/data/types';

export interface Limits {
  maxIngredientSwing: number;
  maxRemovedShare: number;
}

export const DEFAULT_LIMITS: Readonly<Limits>;

export function monthOf(iso: string): string;

export function newSlugs(
  previous: Pick<WeaponIndex, 'weapons' | 'generatedAt'> | null | undefined,
  nextSlugs: Iterable<string>,
  nowIso: string
): Set<string>;

export interface Named {
  slug: string;
  name: string;
}

export interface EdgeChange {
  slug: string;
  copies: number;
}

export interface RecipeChange extends Named {
  added: EdgeChange[];
  removed: EdgeChange[];
  changed: { slug: string; from: number; to: number }[];
}

export interface DiffReport {
  fromVersion: string;
  toVersion: string;
  counts: {
    old: { weapons: number; ingredients: number };
    next: { weapons: number; ingredients: number };
  };
  added: Named[];
  removed: Named[];
  recipeChanges: RecipeChange[];
  ingredientsAdded: Named[];
  ingredientsRemoved: Named[];
  imageChanges: (Named & { from: string; to: string })[];
  displayChanges: (Named & { fields: string[] })[];
  changed: boolean;
}

export function diffIndexes(old: WeaponIndex, next: WeaponIndex): DiffReport;

export interface Decision {
  status: 'unchanged' | 'publish' | 'blocked';
  reasons: string[];
  accepted: string[];
}

export function decide(
  report: DiffReport,
  options?: { accept?: boolean; limits?: Limits }
): Decision;

export function renderReport(
  report: DiffReport,
  decision: Decision,
  options?: { runUrl?: string }
): string;

export function changelogEntry(
  report: DiffReport,
  nowIso: string
): {
  date: string;
  fromVersion: string;
  toVersion: string;
  added: Named[];
  removed: Named[];
  recipeChanges: Named[];
  imageChanges: Named[];
};
