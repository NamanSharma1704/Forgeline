'use client';

import { isArsenalSetUp } from '@/engine';
import { STATUS_LABEL, statusIn } from '@/store/arsenal';
import { useArsenal } from '@/store/useArsenal';

/**
 * The player's status on a family-tree box (spec 5.3), shown only once the arsenal is set up so the
 * tree is not a wall of guessed "Not owned".
 */
export function StatusTag({ slug }: { slug: string }) {
  const { ready, arsenal } = useArsenal();
  if (!ready || !isArsenalSetUp(arsenal.entries)) return null;
  const status = statusIn(arsenal, slug);
  return (
    <span className="status-tag" data-status={status}>
      {STATUS_LABEL[status]}
    </span>
  );
}
