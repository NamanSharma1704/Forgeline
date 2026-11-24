'use client';

import { useState } from 'react';
import type { Weapon } from '@/data/types';

/**
 * A weapon picture, served from Forgeline's own hosting (spec 5.11).
 *
 * Next's image optimiser is off because the build already produced exactly two sizes, so a plain
 * <img> with explicit dimensions is both lighter and immune to layout shift. If a file is missing or
 * fails to load, a neutral placeholder takes its place so the layout never breaks.
 *
 * The placeholder is deliberately plain. Per-slot silhouettes are a design task for M3.
 */

const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="presentation">
       <rect width="64" height="64" fill="none"/>
       <path d="M12 40l14-20 12 8 8-6 6 18z" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="2"/>
     </svg>`
  );

type Size = 'thumb' | 'large';

const DIMENSIONS: Record<Size, number> = { thumb: 48, large: 256 };

export function WeaponArt({
  weapon,
  size = 'thumb',
  priority = false,
}: {
  weapon: Pick<Weapon, 'name' | 'image' | 'thumb'>;
  size?: Size;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const side = DIMENSIONS[size];
  const src = failed ? PLACEHOLDER : `/${size === 'thumb' ? weapon.thumb : weapon.image}`;

  return (
    <img
      className="weapon-art"
      src={src}
      alt={weapon.name}
      width={side}
      height={side}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : 'auto'}
      onError={() => setFailed(true)}
    />
  );
}
