/**
 * Plain outline silhouettes, one per slot, shown when a weapon picture is missing or fails to load
 * (spec 5.11), so the layout never breaks and the slot is still readable at a glance.
 */

import type { Slot } from '@/data/types';

const SHAPES: Record<Slot, React.ReactNode> = {
  // A long gun: stock, receiver, barrel, magazine.
  primary: (
    <>
      <path d="M5 29h31l4-4h17v6h-9v3H35l-5 9h-6l3-9H16l-5 7H5z" />
      <path d="M27 34l1.5 3" />
    </>
  ),
  // A sidearm: slide, grip, trigger guard.
  secondary: (
    <>
      <path d="M12 21h40v8H34l-3 3v12h-9l2-15H12z" />
      <path d="M31 32h-4" />
    </>
  ),
  // A straight blade on the diagonal: edge, guard, grip, pommel.
  melee: (
    <>
      <path d="M52 7h5v5L30 39l-5-5z" />
      <path d="M19 31l14 14" />
      <path d="M24 40l-9 9" />
      <circle cx="13" cy="51" r="2.5" />
    </>
  ),
  // A heavy gun: deep body, drum, long barrel.
  'arch-gun': (
    <>
      <path d="M4 27h40l4-5h12v12h-8v4H40l-4 8h-8l2-8H4z" />
      <path d="M14 27v-5h14v5" />
    </>
  ),
  // A great blade: broad head, cross guard, long haft.
  'arch-melee': (
    <>
      <path d="M32 5l10 14-6 25h-8l-6-25z" />
      <path d="M22 44h20" />
      <path d="M32 44v15" />
    </>
  ),
  // A companion weapon: compact drone body with emitters.
  companion: (
    <>
      <circle cx="32" cy="30" r="11" />
      <path d="M21 30H9M55 30H43M32 41v11" />
      <circle cx="32" cy="30" r="3.5" />
    </>
  ),
};

export function Silhouette({ slot }: { slot: Slot }) {
  return (
    <svg
      className="silhouette"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES[slot]}
    </svg>
  );
}
