'use client';

import { useEffect } from 'react';
import type { Slot } from '@/data/types';
import type { TileWeapon } from './ArsenalTile';

/**
 * Recently checked weapons, for Home's console (design plan 5): the last eight weapon pages opened
 * in this browser, newest first. Kept in this browser only, like the arsenal; nothing is sent.
 */
const KEY = 'forgeline-recent';
const LIMIT = 8;
const SLOTS: readonly Slot[] = ['primary', 'secondary', 'melee', 'arch-gun', 'arch-melee', 'companion'];

const isTile = (value: unknown): value is TileWeapon => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.slug === 'string' &&
    typeof v.name === 'string' &&
    typeof v.image === 'string' &&
    typeof v.thumb === 'string' &&
    typeof v.mr === 'number' &&
    SLOTS.includes(v.slot as Slot)
  );
};

export function readRecent(): TileWeapon[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter(isTile).slice(0, LIMIT) : [];
  } catch {
    return [];
  }
}

/** Records the weapon whose page this is. Renders nothing. */
export function RecordVisit({ weapon }: { weapon: TileWeapon }) {
  const { slug } = weapon;
  useEffect(() => {
    try {
      const rest = readRecent().filter((recent) => recent.slug !== slug);
      localStorage.setItem(KEY, JSON.stringify([weapon, ...rest].slice(0, LIMIT)));
    } catch {
      // Storage refused (private mode, full): the console simply has no recent list.
    }
    // Once per weapon; the object is rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
  return null;
}
