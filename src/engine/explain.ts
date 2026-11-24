/**
 * Turns a Verdict into plain English: the headline, the reason lines, the full chains and the text
 * for the "Copy result" button. Pure, so the wording is tested alongside the arithmetic.
 *
 * Spec 5.2: "The rules always explain themselves. A verdict without a reason is easy to ignore."
 */

import { hardToGetSentence } from './recovery';
import type { CheckTarget, RecipeGraph, TargetLine, Verdict } from './types';

export type Tone = 'safe' | 'safe-soft' | 'check' | 'keep';

export interface Explanation {
  /** The banner: "Keep 3", "Safe to sell", "Check". */
  readonly headline: string;
  /** Drives colour and icon. Never shown as the only signal. */
  readonly tone: Tone;
  /** One sentence under the banner. */
  readonly summary: string;
  /** One sentence per weapon the checked weapon builds. */
  readonly lines: readonly string[];
  /**
   * One short phrase per weapon it builds, in the same order, without that weapon's name: for rows
   * that already show the name and picture beside it. "2 copies, then Akjagara", "Already mastered".
   */
  readonly notes: readonly string[];
  /** Full chains from the checked weapon, e.g. "Lato → Bolto → Akbolto → Akjagara". */
  readonly chains: readonly string[];
  /** The note about levelling the weapon before selling it, when it applies. */
  readonly mastery: string | null;
  /**
   * The note that the weapon can take an Incarnon Genesis (M6.5, 12.2), when it can. It never
   * changes the verdict: recipes decide that. It is said alongside, because a weapon that is safe for
   * recipes can still be one a player would regret selling.
   */
  readonly incarnon: string | null;
  /**
   * Why the weapon would be hard to get again (M6.5, 12.1), when it would be. Like the Incarnon
   * note, it never changes the verdict; the card shows it under a Safe verdict, where it matters.
   */
  readonly recovery: string | null;
  /** One line of plain ASCII for pasting into in-game clan chat. */
  readonly copyText: string;
}

const ARROW = ' → ';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** "A", "A and B", "A, B and C". */
export function listOf(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const unique = <T>(items: readonly T[]) => [...new Set(items)];

export function explain(verdict: Verdict, graph: RecipeGraph): Explanation {
  const name = (slug: string) => graph.get(slug).name;
  const weapon = name(verdict.slug);

  const fullChains = (chains: readonly (readonly string[])[]) =>
    chains.map((chain) => [verdict.slug, ...chain].map(name).join(ARROW));

  // Where each target's chains finish, and the step straight after the target.
  const ends = (chains: readonly (readonly string[])[]) =>
    unique(chains.map((chain) => chain[chain.length - 1]!)).map(name);
  const nextSteps = (chains: readonly (readonly string[])[]) =>
    unique(chains.map((chain) => chain[1]!)).map(name);

  const targetLine = (target: TargetLine, forChat: boolean): string => {
    const t = name(target.slug);
    switch (target.reason) {
      case 'needs-building': {
        let line = `${target.copiesNeeded} for ${t}`;
        if (target.buildsNeeded > 1) line += `, which you need to build ${target.buildsNeeded} times`;
        if (target.chains.length > 0) line += `, on the way to ${listOf(ends(target.chains))}`;
        if (target.statusAssumed && !forChat) line += ` (${t} not marked yet)`;
        return `${line}.`;
      }
      case 'feeds-chain': {
        const next = nextSteps(target.chains);
        const further = ends(target.chains).filter((end) => !next.includes(end));
        let line = `${target.copiesNeeded} for ${t}, which ${listOf(next)} still ${plural(next.length, 'needs', 'need')}`;
        if (further.length > 0) line += `, on the way to ${listOf(further)}`;
        return `${line}.`;
      }
      case 'mastered':
        return `${t} is already mastered.`;
      case 'held-unmastered':
        return `You already own ${t}. Level it before selling that.`;
    }
  };

  const checkLine = (target: CheckTarget): string => {
    let line = `${name(target.slug)}: ${target.copies} ${plural(target.copies, 'copy', 'copies')}`;
    if (target.chains.length > 0) line += `, then ${listOf(ends(target.chains))}`;
    return `${line}.`;
  };

  // The short forms, for rows that show the target's name and picture beside the note.
  const copiesOf = (n: number) => `${n} ${plural(n, 'copy', 'copies')}`;
  const checkNote = (target: CheckTarget): string => {
    let note = copiesOf(target.copies);
    if (target.chains.length > 0) note += `, then ${listOf(ends(target.chains))}`;
    return note;
  };
  const targetNote = (target: TargetLine): string => {
    switch (target.reason) {
      case 'needs-building': {
        let note = copiesOf(target.copiesNeeded);
        if (target.buildsNeeded > 1) note += `, built ${target.buildsNeeded} times`;
        if (target.chains.length > 0) note += `, on the way to ${listOf(ends(target.chains))}`;
        if (target.statusAssumed) note += ', not marked yet';
        return note;
      }
      case 'feeds-chain': {
        const next = nextSteps(target.chains);
        return `${copiesOf(target.copiesNeeded)}, ${listOf(next)} still ${plural(next.length, 'needs', 'need')} it`;
      }
      case 'mastered':
        return 'Already mastered';
      case 'held-unmastered':
        return 'Owned: level it before selling that';
    }
  };
  const notes =
    verdict.kind === 'check' ? verdict.targets.map(checkNote) : verdict.targets.map(targetNote);

  let headline: string;
  let tone: Tone;
  let summary: string;
  let lines: string[] = [];
  let chatLines: string[] = [];
  let chains: string[] = [];

  switch (verdict.kind) {
    case 'check': {
      headline = 'Check';
      tone = 'check';
      const builds = verdict.targets.map(
        (target) =>
          `${name(target.slug)} (${target.copies} ${plural(target.copies, 'copy', 'copies')})`
      );
      // Phase 1 has no arsenal, so the Check has to be actionable on its own: what it builds, the
      // condition under which it is safe, and the from-scratch number.
      const targetNames = verdict.targets.map((target) => name(target.slug));
      const which =
        targetNames.length === 1
          ? targetNames[0]!
          : targetNames.length === 2
            ? 'both'
            : 'all of them';
      const direct = verdict.targets.reduce((n, target) => n + target.copies, 0);
      const feeders = verdict.targets
        .filter((target) => target.chains.length > 0)
        .map((target) => name(target.slug));
      const n = verdict.keepIfNothingBuilt;
      let fromScratch = `Building ${plural(targetNames.length, 'it', 'them')} from scratch takes ${n} ${plural(n, 'copy', 'copies')}`;
      if (n > direct && feeders.length > 0) {
        fromScratch += `, since ${listOf(feeders)} ${plural(feeders.length, 'feeds', 'feed')} further recipes`;
      }
      summary = `${weapon} is used to build ${listOf(builds)}. Keep it unless you have already built and mastered ${which}. ${fromScratch}.`;
      lines = verdict.targets.map(checkLine);
      chatLines = lines;
      chains = verdict.targets.flatMap((target) => fullChains(target.chains));
      break;
    }
    case 'keep': {
      headline = `Keep ${verdict.keep}`;
      tone = 'keep';
      summary = `Recipes you haven't finished need ${verdict.keep} ${plural(verdict.keep, 'copy', 'copies')} of ${weapon}.`;
      if (verdict.have > 0) summary += ` You have ${verdict.have}.`;
      lines = verdict.targets.map((target) => targetLine(target, false));
      chatLines = verdict.targets
        .filter((target) => target.copiesNeeded > 0)
        .map((target) => targetLine(target, true));
      chains = verdict.targets.flatMap((target) => fullChains(target.chains));
      break;
    }
    case 'safe': {
      lines = verdict.targets.map((target) => targetLine(target, false));
      chatLines = verdict.targets.map((target) => targetLine(target, true));
      switch (verdict.basis) {
        case 'not-an-ingredient':
          headline = 'Safe to sell';
          tone = 'safe';
          summary = `${weapon} isn't used in any recipe.`;
          break;
        case 'all-mastered':
          headline = 'Safe to sell';
          tone = 'safe';
          summary = 'Everything this builds is already mastered.';
          break;
        case 'targets-held':
          headline = 'Safe to sell';
          tone = 'safe-soft';
          summary = `Nothing you still have to build needs a copy of ${weapon}.`;
          break;
        case 'surplus': {
          const spare = verdict.have - verdict.keep;
          headline = `Safe to sell ${spare}`;
          tone = 'safe';
          summary = `You need ${verdict.keep} and have ${verdict.have}, so ${spare} ${plural(spare, 'is', 'are')} spare.`;
          chatLines = verdict.targets
            .filter((target) => target.copiesNeeded > 0)
            .map((target) => targetLine(target, true));
          chains = verdict.targets.flatMap((target) => fullChains(target.chains));
          break;
        }
      }
      break;
    }
  }

  let mastery: string | null = null;
  if (verdict.mastery) {
    const { maxRank, mastery: points } = verdict.mastery;
    mastery =
      verdict.mastery.kind === 'unmastered'
        ? `You haven't mastered ${weapon} yet. Levelling it to rank ${maxRank} is worth ${thousands(points)} mastery, and that stays after you sell it.`
        : `If ${weapon} isn't rank ${maxRank} yet, level it before you sell it: that's ${thousands(points)} mastery, and it stays after you sell.`;
  }

  const adapter = graph.get(verdict.slug).incarnon;
  const incarnon = adapter
    ? `${weapon} can take the ${adapter}, a Steel Path Circuit reward that gives it an Incarnon form.` +
      (verdict.kind === 'safe'
        ? ' Worth keeping if you might use that, whatever the recipes say.'
        : ' One more reason to keep it.')
    : null;

  const hard = graph.get(verdict.slug).hardToGet;
  const recovery = hard ? hardToGetSentence(hard) : null;

  const chat = [
    `${weapon}: ${headline}.`,
    ...(chatLines.length > 0 ? chatLines : [summary]),
    ...(recovery && verdict.kind === 'safe' ? [recovery] : []),
    ...(adapter ? [`Can take the ${adapter}.`] : []),
  ]
    .join(' ')
    .replaceAll('→', '->');

  return {
    headline,
    tone,
    summary,
    lines,
    notes,
    chains: unique(chains),
    mastery,
    incarnon,
    recovery,
    copyText: chat,
  };
}
