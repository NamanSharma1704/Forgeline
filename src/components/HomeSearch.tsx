'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Slot } from '@/data/types';
import type { SearchEntry } from '@/search/rank';
import { WeaponArt, type ArtWeapon } from './WeaponArt';
import { WeaponSearch } from './WeaponSearch';

/**
 * The home page's search console (design plan 3.2 and 3.3): the search itself, a category strip
 * that narrows what it finds, and quick picks underneath. The strip filters as the player types;
 * it never hides the field or changes the page.
 */

type Scope = 'all' | 'ingredients' | 'primary' | 'secondary' | 'melee';

const SCOPES: readonly { scope: Scope; label: string; noun: string }[] = [
  { scope: 'all', label: 'All weapons', noun: 'weapons' },
  { scope: 'ingredients', label: 'Core ingredients', noun: 'ingredients' },
  { scope: 'primary', label: 'Primary', noun: 'primaries' },
  { scope: 'secondary', label: 'Secondary', noun: 'secondaries' },
  { scope: 'melee', label: 'Melee', noun: 'melee weapons' },
];

const FILTERS: Record<Scope, ((entry: SearchEntry) => boolean) | undefined> = {
  all: undefined,
  ingredients: (entry) => entry.b > 0,
  primary: (entry) => entry.t === 'primary',
  secondary: (entry) => entry.t === 'secondary',
  melee: (entry) => entry.t === 'melee',
};

export interface QuickPick extends ArtWeapon {
  readonly slug: string;
  readonly slot: Slot;
}

export function HomeSearch({
  counts,
  quick,
}: {
  counts: Readonly<Record<Scope, number>>;
  quick: readonly QuickPick[];
}) {
  const [scope, setScope] = useState<Scope>('all');
  const current = SCOPES.find((s) => s.scope === scope)!;
  const filter = useMemo(() => FILTERS[scope], [scope]);

  return (
    <div className="console">
      <WeaponSearch
        variant="hero"
        filter={filter}
        placeholder={`Search ${counts[scope]} ${current.noun}`}
        label={`Search ${current.noun}`}
      />

      <div className="console__scopes" role="group" aria-label="What to search">
        {SCOPES.map(({ scope: candidate, label }) => (
          <button
            key={candidate}
            type="button"
            className="chip"
            aria-pressed={scope === candidate}
            onClick={() => setScope(candidate)}
          >
            {label} <span className="chip__count telemetry">{counts[candidate]}</span>
          </button>
        ))}
      </div>

      <div className="console__quick">
        <span className="console__quick-label">Quick check</span>
        <ul className="quick-picks">
          {quick.map((weapon) => (
            <li key={weapon.slug}>
              <Link href={`/w/${weapon.slug}/`} className="quick-pick shape" data-slot={weapon.slot}>
                <WeaponArt weapon={weapon} />
                <span>{weapon.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
