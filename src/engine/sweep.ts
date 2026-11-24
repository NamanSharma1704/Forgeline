/**
 * The slot-clearing sweep (spec 5.5): every weapon the player holds, sorted into Safe to sell and
 * Keep, each with a one-line reason. "I'm out of slots, what can I get rid of?"
 *
 * Safe to sell means mastered and not needed by anything unbuilt. A weapon that is not mastered
 * yet always lands in Keep, because selling it throws away its mastery.
 */

import { listOf } from './explain';
import { holds, statusOf } from './status';
import type { Arsenal, RecipeGraph, Verdict } from './types';
import { createEvaluator } from './verdict';

export interface SweepItem {
  readonly slug: string;
  readonly status: 'owned' | 'mastered';
  readonly verdict: Verdict;
  readonly reason: string;
}

export interface SweepResult {
  readonly safe: readonly SweepItem[];
  readonly keep: readonly SweepItem[];
}

export function sweep(graph: RecipeGraph, arsenal: Arsenal): SweepResult {
  const evaluator = createEvaluator(graph, arsenal);
  const name = (slug: string) => graph.get(slug).name;
  const safe: SweepItem[] = [];
  const keep: SweepItem[] = [];

  const heldSlugs = Object.entries(arsenal)
    .filter(([slug, entry]) => entry && holds(entry.status) && graph.has(slug))
    .map(([slug]) => slug);

  for (const slug of heldSlugs) {
    const status = statusOf(arsenal, slug) as 'owned' | 'mastered';
    const verdict = evaluator.verdict(slug);
    const { maxRank } = graph.get(slug);
    const notMastered = `Not mastered yet. Level it to rank ${maxRank} first; the mastery stays after you sell it.`;

    if (verdict.kind === 'keep') {
      const outstanding = verdict.targets
        .filter((target) => target.copiesNeeded > 0)
        .map((target) => name(target.slug));
      let reason = `Keep ${verdict.keep} for ${listOf(outstanding)}.`;
      if (status === 'owned') reason += ' Not mastered yet either.';
      keep.push({ slug, status, verdict, reason });
      continue;
    }
    if (status === 'owned' || verdict.kind === 'check') {
      keep.push({ slug, status, verdict, reason: notMastered });
      continue;
    }

    let reason: string;
    switch (verdict.basis) {
      case 'not-an-ingredient':
        reason = 'Mastered, and not used in any recipe.';
        break;
      case 'all-mastered':
        reason = 'Mastered, and everything it builds is mastered too.';
        break;
      case 'targets-held': {
        const unlevelled = verdict.targets
          .filter((target) => target.reason === 'held-unmastered')
          .map((target) => name(target.slug));
        reason = `Mastered, and nothing needs another copy. Level your ${listOf(unlevelled)} before selling that.`;
        break;
      }
      case 'surplus':
        reason = `Mastered, and you hold ${verdict.have - verdict.keep} more than recipes need.`;
        break;
    }
    safe.push({ slug, status, verdict, reason });
  }

  const byName = (a: SweepItem, b: SweepItem) => name(a.slug).localeCompare(name(b.slug), 'en');
  return { safe: safe.sort(byName), keep: keep.sort(byName) };
}
