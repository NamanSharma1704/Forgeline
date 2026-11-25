'use client';

import { isArsenalSetUp } from '@/engine';
import { STATUS_LABEL, statusIn } from '@/store/arsenal';
import { useArsenal } from '@/store/useArsenal';

/**
 * The player's status on a family-tree box (spec 5.3), shown only once the arsenal is set up so the
 * tree is not a wall of guessed "Not owned".
 */
function useTreeStatus(slug: string) {
  const { ready, arsenal } = useArsenal();
  if (!ready || !isArsenalSetUp(arsenal.entries)) return null;
  return statusIn(arsenal, slug);
}

export function StatusTag({ slug }: { slug: string }) {
  const status = useTreeStatus(slug);
  if (!status) return null;
  return (
    <span className="status-tag" data-status={status}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/**
 * The same status as a halo round the box's picture (design plan 4.4): green once mastered, cyan
 * while owned, dim otherwise. Always paired with StatusTag's word, never the only signal.
 */
export function StatusRing({ slug }: { slug: string }) {
  const status = useTreeStatus(slug);
  if (!status) return null;
  return <span className="status-ring" data-status={status} aria-hidden="true" />;
}
