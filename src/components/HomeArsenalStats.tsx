'use client';

import { useMemo } from 'react';
import { sweep } from '@/engine';
import { tally, toEngineArsenal } from '@/store/arsenal';
import { useArsenal } from '@/store/useArsenal';
import { useRecipeGraph } from '@/store/useRecipeGraph';
import { Telemetry } from './shell/ScreenHeader';

/**
 * The home page's live arsenal figures (design plan 3.4 and 3.5), read from this browser. Pages are
 * pre-rendered with no arsenal, so both pieces render nothing until it is read, and the strip stays
 * hidden for a player who has marked nothing: no row of zeros.
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

/** "Your arsenal // 12 owned · 30 mastered · 4 safe to sell", once there is something to say. */
export function HomeArsenalStats() {
  const { ready, counts, safe } = useArsenalSummary();
  if (!ready || counts.recorded === 0) return null;
  return (
    <p className="arsenal-strip telemetry">
      <span className="arsenal-strip__label">Your arsenal</span>
      <span className="arsenal-strip__sep" aria-hidden="true">
        {'//'}
      </span>
      <span>
        <strong>{counts.owned}</strong> owned
      </span>
      <span aria-hidden="true">·</span>
      <span>
        <strong>{counts.masteryDone}</strong> mastered
      </span>
      {safe !== null && (
        <>
          <span aria-hidden="true">·</span>
          <span>
            <strong>{safe}</strong> safe to sell
          </span>
        </>
      )}
    </p>
  );
}

/** The Slot Sweep header's figure: slots that can be freed, once there is an arsenal to sweep. */
export function FreeableTelemetry() {
  const { ready, held, safe } = useArsenalSummary();
  if (!ready || held === 0 || safe === null) return null;
  return <Telemetry label="Freeable" value={safe} />;
}

/** The sweep card's figure: how many held weapons can go, or a prompt before there are any. */
export function SweepFigure() {
  const { ready, held, safe } = useArsenalSummary();
  if (!ready || held === 0 || safe === null) {
    return <span className="tool-card__figure tool-card__figure--quiet telemetry">Sort what you hold</span>;
  }
  return (
    <span className="tool-card__figure telemetry">
      {safe} <small>{safe === 1 ? 'slot can be freed' : 'slots can be freed'}</small>
    </span>
  );
}
