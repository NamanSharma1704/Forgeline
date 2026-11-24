/**
 * The sell-check verdict. Decision order from docs/verdict-rules.md section 3, first match wins:
 *
 *   1. builds nothing                               -> safe   (not-an-ingredient)
 *   2. arsenal not set up                           -> check
 *   3. nothing outstanding, every target mastered   -> safe   (all-mastered)
 *   4. nothing outstanding, a target held unlevelled-> safe   (targets-held, soft)
 *   5. copies outstanding                           -> keep N, or safe (surplus) if they hold more
 *
 * Every verdict carries every target with its own reason, so a card can always say why, and a player
 * reporting a wrong answer can point at the exact line.
 */

import { createDemand, type Demand } from './demand';
import {
  heldCount,
  isArsenalSetUp,
  isRecorded,
  masteryDone,
  masteryFor,
  statusOf,
} from './status';
import type {
  Arsenal,
  CheckTarget,
  GraphNode,
  MasteryNote,
  RecipeGraph,
  TargetLine,
  TargetReason,
  Verdict,
} from './types';

/** Enough to show every real branch (the widest today is two) without a pathological fan-out. */
const MAX_PATHS = 8;

/**
 * Every path from `from` down the graph, following only children that pass `include`, `from` first.
 * A target with no qualifying children yields no paths: a one-element "chain" says nothing.
 */
function pathsFrom(
  graph: RecipeGraph,
  from: string,
  include: (slug: string) => boolean
): string[][] {
  const found: string[][] = [];
  const walk = (slug: string, trail: string[]) => {
    if (found.length >= MAX_PATHS) return;
    const next = graph.get(slug).usedToBuild.filter((edge) => include(edge.slug));
    if (next.length === 0) {
      if (trail.length > 1) found.push(trail);
      return;
    }
    for (const edge of next) walk(edge.slug, [...trail, edge.slug]);
  };
  walk(from, [from]);
  return found;
}

function masteryNote(node: GraphNode, arsenal: Arsenal): MasteryNote | null {
  const status = statusOf(arsenal, node.slug);
  if (masteryDone(status)) return null;
  const detail = { maxRank: node.maxRank, mastery: masteryFor(node.maxRank) };
  return status === 'owned'
    ? { kind: 'unmastered', ...detail }
    : { kind: 'maybe-unmastered', ...detail };
}

function targetReason(arsenal: Arsenal, slug: string, buildsNeeded: number): TargetReason {
  const status = statusOf(arsenal, slug);
  if (buildsNeeded > 0) return status === 'notOwned' ? 'needs-building' : 'feeds-chain';
  return masteryDone(status) ? 'mastered' : 'held-unmastered';
}

export interface Evaluator {
  /** The memoised demand for this arsenal, shared by every verdict the evaluator produces. */
  readonly demand: Demand;
  /** Whether the arsenal has enough in it for personal verdicts rather than Check. */
  readonly arsenalSetUp: boolean;
  verdict(slug: string): Verdict;
}

/**
 * One evaluator per arsenal. Use it when checking many weapons at once, such as the slot sweep:
 * the demand arithmetic is shared, so the whole arsenal costs one pass over the graph.
 */
export function createEvaluator(graph: RecipeGraph, arsenal: Arsenal): Evaluator {
  const demand = createDemand(graph, arsenal);
  const arsenalSetUp = isArsenalSetUp(arsenal);
  const cache = new Map<string, Verdict>();

  const outstanding = (slug: string) => demand.buildsNeeded(slug) > 0;

  const verdict = (slug: string): Verdict => {
    const cached = cache.get(slug);
    if (cached) return cached;

    const node = graph.get(slug);
    const mastery = masteryNote(node, arsenal);
    const have = heldCount(arsenal, slug);
    let result: Verdict;

    if (node.usedToBuild.length === 0) {
      // Rule 1. Holds before the arsenal check: a weapon that builds nothing is safe for everyone.
      result = {
        kind: 'safe',
        basis: 'not-an-ingredient',
        soft: false,
        keep: 0,
        have,
        targets: [],
        slug,
        mastery,
      };
    } else if (!arsenalSetUp) {
      // Rule 2. Without statuses the arithmetic would only be guessing, so say what it builds.
      const targets: CheckTarget[] = node.usedToBuild.map((edge) => ({
        slug: edge.slug,
        copies: edge.copies,
        chains: pathsFrom(graph, edge.slug, () => true),
      }));
      // With no statuses recorded every weapon counts as not owned, so the demand for this arsenal
      // is exactly the from-scratch number.
      const keepIfNothingBuilt = demand.consumedByChildren(slug);
      result = { kind: 'check', targets, keepIfNothingBuilt, slug, mastery };
    } else {
      const targets: TargetLine[] = node.usedToBuild.map((edge) => {
        const buildsNeeded = demand.buildsNeeded(edge.slug);
        return {
          slug: edge.slug,
          copiesPerBuild: edge.copies,
          buildsNeeded,
          copiesNeeded: edge.copies * buildsNeeded,
          status: statusOf(arsenal, edge.slug),
          statusAssumed: !isRecorded(arsenal, edge.slug),
          reason: targetReason(arsenal, edge.slug, buildsNeeded),
          chains: buildsNeeded > 0 ? pathsFrom(graph, edge.slug, outstanding) : [],
        };
      });
      const keep = demand.consumedByChildren(slug);

      if (keep === 0) {
        // Rules 3 and 4.
        const soft = targets.some((target) => target.reason === 'held-unmastered');
        result = {
          kind: 'safe',
          basis: soft ? 'targets-held' : 'all-mastered',
          soft,
          keep: 0,
          have,
          targets,
          slug,
          mastery,
        };
      } else if (have > keep) {
        // Rule 5, with copies to spare. Only reachable when the player tracks a quantity.
        result = {
          kind: 'safe',
          basis: 'surplus',
          soft: false,
          keep,
          have,
          targets,
          slug,
          mastery,
        };
      } else {
        // Rule 5.
        result = { kind: 'keep', keep, have, targets, slug, mastery };
      }
    }

    cache.set(slug, result);
    return result;
  };

  return { demand, arsenalSetUp, verdict };
}

/** Convenience for a single check. Prefer `createEvaluator` when checking several weapons. */
export const computeVerdict = (graph: RecipeGraph, arsenal: Arsenal, slug: string): Verdict =>
  createEvaluator(graph, arsenal).verdict(slug);
