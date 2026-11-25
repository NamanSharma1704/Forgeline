'use client';

import { useMemo } from 'react';
import { sweep } from '@/engine';
import { tally, toEngineArsenal } from '@/store/arsenal';
import { useArsenal } from '@/store/useArsenal';
import { useRecipeGraph } from '@/store/useRecipeGraph';

/**
 * The player's own figures, read from this browser, for the console's launchers (design plan 5).
 * Pages are pre-rendered with no arsenal, so each shows a prompt until the arsenal is read: never a
 * row of zeros presented as fact.
 */
function useArsenalSummary() {
  const { ready, arsenal } = useArsenal();
  const entries = useMemo(() => toEngineArsenal(arsenal), [arsenal]);
  const counts = tally(arsenal);
  const held = counts.owned + counts.mastered;
  const { graph } = useRecipeGraph(ready && held > 0);
  const safe = useMemo(() => (graph && held > 0 ? sweep(graph, entries).safe.length : null), [graph, entries, held]);
  return { ready, counts, held, safe };
}

/** The Sweep launcher's figure: how many held weapons can go, or a prompt before there are any. */
export function SweepFigure() {
  const { ready, held, safe } = useArsenalSummary();
  if (!ready || held === 0 || safe === null) return <span className="launcher__figure">Sort what you hold</span>;
  return (
    <span className="launcher__figure">
      <strong>{safe}</strong> {safe === 1 ? 'slot can be freed' : 'slots can be freed'}
    </span>
  );
}

/** The Arsenal launcher's figure: mastery so far, or a prompt before anything is marked. */
export function MasteredFigure({ total }: { total: number }) {
  const { ready, counts } = useArsenalSummary();
  if (!ready || counts.recorded === 0) return <span className="launcher__figure">Mark what you own</span>;
  return (
    <span className="launcher__figure">
      <strong>{counts.masteryDone}</strong>/{total} mastered
    </span>
  );
}
