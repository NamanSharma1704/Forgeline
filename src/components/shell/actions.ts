'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { IconName } from '../Icon';

/**
 * The action bar's registry (design plan 4.4). A screen registers its primary actions here, each
 * with its key; the one ActionDock in the layout draws them bottom right and runs them from the
 * keyboard. A component that already shows its own control (the favourite toggle, the view
 * switch) registers its key with `keyOnly`, so the key works and is listed under "?" without a
 * second button.
 */
export interface ScreenAction {
  readonly id: string;
  readonly label: string;
  /** One key: a letter, or "Escape". Letters are matched without case. */
  readonly keyName?: string;
  readonly icon?: IconName;
  readonly href?: string;
  readonly run?: () => void;
  /** The screen's main action, lit cyan. */
  readonly primary?: boolean;
  /** The key works and is listed, but the control lives elsewhere on the screen. */
  readonly keyOnly?: boolean;
  /** Icon only on phones, where the bar is short of room; the label stays for screen readers. */
  readonly compact?: boolean;
}

const owners = new Map<string, readonly ScreenAction[]>();
const listeners = new Set<() => void>();
const NONE: readonly ScreenAction[] = [];
let snapshot: readonly ScreenAction[] = NONE;

function publish() {
  snapshot = owners.size ? [...owners.values()].flat() : NONE;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Every action registered now, for the key handler, which reads them when a key is pressed. */
export const currentActions = () => snapshot;

export function useActions() {
  return useSyncExternalStore(subscribe, currentActions, () => NONE);
}

/**
 * Registers `actions` for as long as the calling component is mounted. They are re-registered on
 * each render, so labels and handlers are always the current ones.
 */
export function useScreenActions(owner: string, actions: readonly ScreenAction[]) {
  useEffect(() => {
    owners.set(owner, actions);
    publish();
  });
  useEffect(
    () => () => {
      owners.delete(owner);
      publish();
    },
    [owner]
  );
}

/** "Escape" reads as "Esc"; letters as capitals. */
export const keyLabel = (keyName: string) => (keyName === 'Escape' ? 'Esc' : keyName.toUpperCase());

/** For aria-keyshortcuts: "C", "Escape". */
export const keyAria = (keyName: string) => (keyName.length === 1 ? keyName.toUpperCase() : keyName);

/** Whether the player has moved between screens in this tab, so "Back" stays on the site. */
let movedInApp = false;
export const markMovedInApp = () => {
  movedInApp = true;
};
export const hasMovedInApp = () => movedInApp;
