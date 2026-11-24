/**
 * The build planner (spec 5.6). The player picks a weapon they want; the plan lists every weapon
 * needed down the whole chain with copy counts, which of those they already hold, and what is left
 * to build or get, in the order to work through it.
 *
 * Held copies count towards what is needed: feeding a recipe consumes the copy, but its mastery
 * stays, so a mastered Bolto in the inventory is as good as a new one. The target itself is always
 * planned as one new build, because a player planning a weapon wants another copy of it.
 */

import { heldCount, statusOf } from './status';
import type { Arsenal, OwnershipStatus, RecipeGraph } from './types';

export interface PlanLine {
  readonly slug: string;
  /** Copies the whole plan consumes; 1 for the target. */
  readonly needed: number;
  /** Copies the player holds that count towards it; always 0 for the target. */
  readonly have: number;
  /** Copies still to make: build them if `craftable`, otherwise get them (blueprint or market). */
  readonly toMake: number;
  /** Longest distance from the target; the target is 0. */
  readonly depth: number;
  /** Built from other weapons. */
  readonly craftable: boolean;
  /** What consumes it in this plan, and how many copies each takes. */
  readonly usedFor: readonly { slug: string; copies: number }[];
  readonly status: OwnershipStatus;
}

export interface BuildPlan {
  readonly target: string;
  /** Target first, then by depth and name. Weapons the plan does not need are left out. */
  readonly lines: readonly PlanLine[];
  /** Lines with something left to make, deepest first: the order to work through them. */
  readonly steps: readonly PlanLine[];
}

export function planBuild(graph: RecipeGraph, arsenal: Arsenal, target: string): BuildPlan {
  // Every weapon below the target, in an order where each comes before its own ingredients
  // (reverse post-order of a depth-first walk; the graph is acyclic by construction).
  const order: string[] = [];
  const visited = new Set<string>();
  const visit = (slug: string) => {
    if (visited.has(slug)) return;
    visited.add(slug);
    for (const edge of graph.get(slug).madeFrom) visit(edge.slug);
    order.push(slug);
  };
  visit(target);
  order.reverse();

  const needed = new Map<string, number>([[target, 1]]);
  const depth = new Map<string, number>([[target, 0]]);
  const usedFor = new Map<string, { slug: string; copies: number }[]>();
  const lines: PlanLine[] = [];

  for (const slug of order) {
    const need = needed.get(slug) ?? 0;
    if (need === 0) continue; // only reachable through a weapon the player already holds enough of
    const have = slug === target ? 0 : Math.min(need, heldCount(arsenal, slug));
    const toMake = need - have;
    const node = graph.get(slug);
    for (const edge of node.madeFrom) {
      if (toMake === 0) break;
      const copies = edge.copies * toMake;
      needed.set(edge.slug, (needed.get(edge.slug) ?? 0) + copies);
      usedFor.set(edge.slug, [...(usedFor.get(edge.slug) ?? []), { slug, copies }]);
      depth.set(edge.slug, Math.max(depth.get(edge.slug) ?? 0, (depth.get(slug) ?? 0) + 1));
    }
    lines.push({
      slug,
      needed: need,
      have,
      toMake,
      depth: depth.get(slug) ?? 0,
      craftable: node.madeFrom.length > 0,
      usedFor: usedFor.get(slug) ?? [],
      status: statusOf(arsenal, slug),
    });
  }

  const name = (slug: string) => graph.get(slug).name;
  const byDepthThenName = (a: PlanLine, b: PlanLine) =>
    a.depth - b.depth || name(a.slug).localeCompare(name(b.slug), 'en');
  const sorted = [...lines].sort(byDepthThenName);
  const steps = sorted
    .filter((line) => line.toMake > 0)
    .sort((a, b) => b.depth - a.depth || name(a.slug).localeCompare(name(b.slug), 'en'));

  return { target, lines: sorted, steps };
}

export interface FoundryStage {
  /** 1 for builds that can start now; each later stage needs something from an earlier one. */
  readonly number: number;
  /** In name order. */
  readonly steps: readonly PlanLine[];
}

export interface FoundryTime {
  readonly stages: readonly FoundryStage[];
  /**
   * Seconds until the target is built, starting every build the moment its ingredients are ready.
   * The Foundry runs any number of builds at once, so copies of one weapon finish together and
   * separate branches overlap: only the slowest chain counts.
   */
  readonly fastest: number;
  /** Seconds if every build, every copy, ran one after another. */
  readonly oneAtATime: number;
  /** Steps whose build time is not known. They count as no time in both totals. */
  readonly unknown: readonly string[];
}

/**
 * When each remaining step can start, and how long the whole plan takes in the Foundry (M6.5,
 * 12.6). A step waits only on its own ingredients that are still to be made; held copies are ready
 * now. Pure: the build times come in through `buildTimeOf`.
 */
export function foundryTime(
  graph: RecipeGraph,
  plan: BuildPlan,
  buildTimeOf: (slug: string) => number | undefined
): FoundryTime {
  const steps = new Map(plan.steps.map((step) => [step.slug, step]));
  const unknown = plan.steps.filter((step) => buildTimeOf(step.slug) === undefined).map((s) => s.slug);
  const time = (slug: string) => buildTimeOf(slug) ?? 0;
  const waitsOn = (slug: string) =>
    graph.get(slug).madeFrom.map((edge) => edge.slug).filter((child) => steps.has(child));

  const stage = new Map<string, number>();
  const finish = new Map<string, number>();
  const walk = (slug: string): void => {
    if (stage.has(slug)) return;
    const children = waitsOn(slug);
    children.forEach(walk);
    stage.set(slug, 1 + Math.max(0, ...children.map((child) => stage.get(child)!)));
    finish.set(slug, time(slug) + Math.max(0, ...children.map((child) => finish.get(child)!)));
  };
  plan.steps.forEach((step) => walk(step.slug));

  const name = (slug: string) => graph.get(slug).name;
  const grouped = new Map<number, PlanLine[]>();
  for (const step of plan.steps) {
    const number = stage.get(step.slug)!;
    grouped.set(number, [...(grouped.get(number) ?? []), step]);
  }
  const stages = [...grouped]
    .sort(([a], [b]) => a - b)
    .map(([number, lines]) => ({
      number,
      steps: lines.sort((a, b) => name(a.slug).localeCompare(name(b.slug), 'en')),
    }));

  return {
    stages,
    fastest: Math.max(0, ...plan.steps.map((step) => finish.get(step.slug)!)),
    oneAtATime: plan.steps.reduce((sum, step) => sum + time(step.slug) * step.toMake, 0),
    unknown,
  };
}

export interface MaterialLike {
  readonly name: string;
  readonly kind: 'blueprint' | 'part' | 'resource';
  readonly count: number;
}

/**
 * Resources across every build the plan still has to make, summed by name. Blueprints and parts
 * belong to one weapon each and are listed per step instead, so they are left out here. Weapons the
 * plan only says to get (not craftable) contribute their own resources too: getting one usually
 * means building it from its blueprint.
 */
export function totalResources(
  plan: BuildPlan,
  materialsOf: (slug: string) => readonly MaterialLike[] | undefined
): { name: string; count: number }[] {
  const totals = new Map<string, number>();
  for (const step of plan.steps) {
    for (const material of materialsOf(step.slug) ?? []) {
      if (material.kind !== 'resource') continue;
      totals.set(material.name, (totals.get(material.name) ?? 0) + material.count * step.toMake);
    }
  }
  return [...totals]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'en'));
}
