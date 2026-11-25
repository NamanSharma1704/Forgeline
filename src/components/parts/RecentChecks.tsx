'use client';

import { useEffect, useState } from 'react';
import type { TileWeapon } from './ArsenalTile';
import { LiveTile } from './LiveTile';
import { readRecent } from './recent';

/** The console's "Recently checked" shelf: hidden until this browser has opened a weapon. */
export function RecentChecks() {
  const [recent, setRecent] = useState<readonly TileWeapon[]>([]);
  // Read after hydration: the page is pre-rendered without it.
  useEffect(() => setRecent(readRecent()), []);
  if (recent.length === 0) return null;
  return (
    <section className="console__shelf" aria-labelledby="recent-title">
      <h2 id="recent-title" className="section-title">
        Recently checked
      </h2>
      <ul className="tile-row">
        {recent.map((weapon) => (
          <li key={weapon.slug}>
            <LiveTile weapon={weapon} href={`/w/${weapon.slug}/`} />
          </li>
        ))}
      </ul>
    </section>
  );
}
