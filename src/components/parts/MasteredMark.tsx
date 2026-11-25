'use client';

import { statusIn } from '@/store/arsenal';
import { useArsenal } from '@/store/useArsenal';
import { Icon } from '../Icon';

/** The laurel, once the player has marked this weapon mastered (design plan 11.7). */
export function MasteredMark({ slug, className }: { slug: string; className?: string }) {
  const { ready, arsenal } = useArsenal();
  if (!ready || statusIn(arsenal, slug) !== 'mastered') return null;
  return (
    <span className={className ? `mastered-mark ${className}` : 'mastered-mark'} title="Mastered">
      <Icon name="laurel" size={24} />
      <span className="sr-only">Mastered</span>
    </span>
  );
}
