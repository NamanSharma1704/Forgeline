import type { IconName } from '../Icon';

/**
 * The four screens a player moves between (design plan 4.3), always one click away: the segment
 * tabs on wide screens, the bottom bar on phones. Routes keep their old paths; the planner is
 * labelled Foundry, as in the game.
 */
export const SEGMENTS: readonly { href: string; label: string; icon: IconName }[] = [
  { href: '/arsenal/', label: 'Arsenal', icon: 'slots' },
  { href: '/sweep/', label: 'Sweep', icon: 'sell' },
  { href: '/plan/', label: 'Foundry', icon: 'queue' },
  { href: '/ingredients/', label: 'Ingredients', icon: 'blueprint' },
];

/** "/plan" and "/plan/" alike. */
export const normalisePath = (path: string | null | undefined) => {
  const here = path || '/';
  return here.endsWith('/') ? here : `${here}/`;
};

export const isCurrent = (path: string, href: string) => normalisePath(path).startsWith(href);

/**
 * The screen title the top bar shows beside the emblem. A weapon's page is its Codex entry. A page
 * that is not a screen (a missing page) gets none, rather than the wordmark repeated.
 */
export function screenOf(path: string): string | null {
  const here = normalisePath(path);
  if (here === '/') return 'Console';
  if (here.startsWith('/w/')) return 'Codex';
  if (here.startsWith('/about/')) return 'About';
  if (here.startsWith('/lab/')) return 'Lab';
  return SEGMENTS.find((segment) => here.startsWith(segment.href))?.label ?? null;
}
