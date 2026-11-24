'use client';

import { useEffect, useState } from 'react';
import { fromGraphFile, type GraphFileNode } from '@/data/graph-file';
import type { Slot } from '@/data/types';
import { createGraph, type RecipeGraph } from '@/engine';

/**
 * Loads /graph.json once per page view, shared by every component that asks, and builds the
 * engine's graph from it, plus each weapon's slot (the engine does not need slots; pictures do, for
 * their fallback silhouette). Pass `enabled: false` to skip the fetch until it is needed: a weapon
 * page only needs the graph once the player has recorded something.
 */

interface Loaded {
  readonly graph: RecipeGraph;
  readonly slots: ReadonlyMap<string, Slot>;
}

let pending: Promise<Loaded> | null = null;

function loadGraph(): Promise<Loaded> {
  if (!pending) {
    pending = fetch('/graph.json')
      .then((response) => {
        if (!response.ok) throw new Error(`graph: HTTP ${response.status}`);
        return response.json() as Promise<GraphFileNode[]>;
      })
      .then((nodes) => ({
        graph: createGraph(fromGraphFile(nodes)),
        slots: new Map(nodes.map((node) => [node.s, node.t])),
      }));
    pending.catch(() => {
      pending = null;
    });
  }
  return pending;
}

export type GraphState =
  | { status: 'idle' | 'loading' | 'error'; graph: null; slots: null }
  | { status: 'ready'; graph: RecipeGraph; slots: ReadonlyMap<string, Slot> };

export function useRecipeGraph(enabled = true): GraphState {
  const [state, setState] = useState<GraphState>({ status: 'idle', graph: null, slots: null });

  useEffect(() => {
    if (!enabled || state.status === 'ready' || state.status === 'loading') return;
    let live = true;
    setState({ status: 'loading', graph: null, slots: null });
    loadGraph().then(
      (loaded) => live && setState({ status: 'ready', ...loaded }),
      () => live && setState({ status: 'error', graph: null, slots: null })
    );
    return () => {
      live = false;
    };
    // Only `enabled` should start a load; the status guard prevents repeats.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return state;
}
