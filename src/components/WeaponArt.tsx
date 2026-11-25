'use client';

import { useEffect, useRef, useState } from 'react';
import type { Slot } from '@/data/types';
import { Silhouette } from './Silhouette';

/**
 * A weapon picture, served from Forgeline's own hosting (spec 5.11).
 *
 * The build already produced exactly two WebP sizes, so a plain <img> with fixed dimensions is
 * lighter than Next's image optimiser and cannot shift the layout. Every picture carries the
 * weapon's name as alt text, as the spec requires.
 *
 * If the file is missing or fails, the slot's silhouette takes its place. An image can fail before
 * React attaches its error handler, so the effect also checks for an already-broken image.
 */

export type ArtSize = 'thumb' | 'medium' | 'large';

/** Display size in CSS pixels. Thumb and medium both use the 96 px file, sharp on 2x screens. */
const PX: Record<ArtSize, number> = { thumb: 44, medium: 72, large: 224 };

export interface ArtWeapon {
  readonly name: string;
  readonly slot: Slot;
  /** img/<slug>.webp, 256 px */
  readonly image: string;
  /** img/thumb/<slug>.webp, 96 px */
  readonly thumb: string;
}

export function WeaponArt({
  weapon,
  size = 'thumb',
  priority = false,
  decorative = false,
}: {
  weapon: ArtWeapon;
  size?: ArtSize;
  priority?: boolean;
  /** Beside the weapon's name already (a tile's nameplate): no alt text, so it is not read twice. */
  decorative?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  const px = PX[size];

  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) {
    return (
      <span
        className={`weapon-art weapon-art--${size} weapon-art--fallback`}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : weapon.name}
        aria-hidden={decorative ? true : undefined}
        style={{ width: px, height: px }}
      >
        <Silhouette slot={weapon.slot} />
      </span>
    );
  }

  return (
    <img
      ref={ref}
      className={`weapon-art weapon-art--${size}`}
      src={`/${size === 'large' ? weapon.image : weapon.thumb}`}
      alt={decorative ? '' : weapon.name}
      width={px}
      height={px}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      onError={() => setFailed(true)}
    />
  );
}
