/**
 * The words for a weapon that would be hard to get again (M6.5, 12.1). Pure, so the verdict card,
 * the copied text and the sweep all say the same thing, at build time and in the browser.
 */

import type { HardToGet } from './types';

/** "A" or "A and B": at most two routes, and no import cycle with explain.ts. */
const listOf = (items: readonly string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** "Complete The New War" becomes "once you have completed The New War". */
function simarisCondition(after: string | undefined): string {
  if (!after) return '';
  const cleaned = after.replace(/\s*\(Quest\)$/, '');
  const complete = /^Complete (.+)$/.exec(cleaned);
  if (complete) return ` once you have completed ${complete[1]}`;
  const unlock = /^Unlock through (.+)$/.exec(cleaned);
  if (unlock) return ` once it is unlocked through ${unlock[1]}`;
  const defeat = /^Defeat (.+)$/.exec(cleaned);
  if (defeat) return ` once you have defeated ${defeat[1]}`;
  return ` (${cleaned})`;
}

export function hardToGetSentence(hard: HardToGet): string {
  switch (hard.kind) {
    case 'vaulted':
      return 'Hard to get back: it is vaulted, so no relic drops it right now.';
    case 'only': {
      const routes = hard.from.map((source) =>
        source === 'simaris'
          ? `Cephalon Simaris, who offers it for standing${simarisCondition(hard.simarisAfter)}`
          : 'drops from the Stalker, who appears only now and then'
      );
      return `Hard to get back: another one depends on ${listOf(routes)}.`;
    }
    case 'event':
      return 'Hard to get back: Vandal and Wraith weapons come from events, Invasions and other limited offers, and may not be offered again for a long time.';
    case 'baro':
      return "Hard to get back: Prisma weapons are sold only by Baro Ki'Teer, and not on every visit.";
  }
}
