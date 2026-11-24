'use client';

import { useSyncExternalStore } from 'react';
import type { OwnershipStatus } from '@/data/types';
import {
  ARSENAL_STORAGE_KEY,
  EMPTY_ARSENAL,
  parseArsenal,
  serialise,
  setFavourite,
  setQty,
  setStatus,
  setStatuses,
  type StoredArsenal,
} from './arsenal';

/**
 * The arsenal as a tiny external store, read through useSyncExternalStore.
 *
 * Pages are pre-rendered at build time, when no arsenal exists, so the server snapshot is null and
 * components render "not ready" rather than a wrong status. After hydration React swaps in the real
 * snapshot from localStorage without a hydration mismatch. A `storage` event keeps other open tabs
 * in step. Every write goes through `commit`, which saves and notifies.
 */

let current: StoredArsenal | null = null;
const listeners = new Set<() => void>();

function load(): StoredArsenal {
  try {
    const raw = localStorage.getItem(ARSENAL_STORAGE_KEY);
    return raw ? parseArsenal(JSON.parse(raw)).arsenal : EMPTY_ARSENAL;
  } catch {
    // Blocked storage or a corrupted value: start empty rather than crash the page.
    return EMPTY_ARSENAL;
  }
}

const snapshot = (): StoredArsenal => (current ??= load());
const serverSnapshot = (): StoredArsenal | null => null;

function onStorage(event: StorageEvent) {
  if (event.key !== ARSENAL_STORAGE_KEY) return;
  current = load();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

function commit(next: StoredArsenal) {
  current = next;
  try {
    localStorage.setItem(ARSENAL_STORAGE_KEY, serialise(next));
  } catch {
    // Storage full or blocked: the change still applies until the tab closes.
  }
  for (const listener of listeners) listener();
}

const now = () => new Date().toISOString();

export const arsenalActions = {
  setStatus: (slug: string, status: OwnershipStatus) => commit(setStatus(snapshot(), slug, status, now())),
  setStatuses: (changes: Readonly<Record<string, OwnershipStatus>>) =>
    commit(setStatuses(snapshot(), changes, now())),
  setQty: (slug: string, qty: number) => commit(setQty(snapshot(), slug, qty, now())),
  setFavourite: (slug: string, favourite: boolean) =>
    commit(setFavourite(snapshot(), slug, favourite, now())),
  replace: (next: StoredArsenal) => commit({ ...next, updatedAt: now() }),
  clear: () => commit({ ...EMPTY_ARSENAL, updatedAt: now() }),
};

/** `ready` is false during pre-rendering and hydration, true once the stored arsenal is read. */
export function useArsenal(): { ready: boolean; arsenal: StoredArsenal } {
  const value = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return value ? { ready: true, arsenal: value } : { ready: false, arsenal: EMPTY_ARSENAL };
}
