'use client';

import { useMemo, useState } from 'react';
import type { SearchEntry } from '@/search/rank';
import { Icon, type IconName } from './Icon';
import { WeaponSearch } from './WeaponSearch';

/**
 * The console's search (design plan 5): the field, then tabs that narrow what it finds, each with
 * its slot's drawn icon and its count. The tabs filter as the player types; they never hide the
 * field or change the page.
 */

type Scope = 'all' | 'ingredients' | 'primary' | 'secondary' | 'melee';

const SCOPES: readonly { scope: Scope; label: string; noun: string; icon: IconName }[] = [
  { scope: 'all', label: 'All', noun: 'weapons', icon: 'diamond' },
  { scope: 'ingredients', label: 'Ingredients', noun: 'ingredients', icon: 'blueprint' },
  { scope: 'primary', label: 'Primary', noun: 'primaries', icon: 'primary' },
  { scope: 'secondary', label: 'Secondary', noun: 'secondaries', icon: 'secondary' },
  { scope: 'melee', label: 'Melee', noun: 'melee weapons', icon: 'melee' },
];

const FILTERS: Record<Scope, ((entry: SearchEntry) => boolean) | undefined> = {
  all: undefined,
  ingredients: (entry) => entry.b > 0,
  primary: (entry) => entry.t === 'primary',
  secondary: (entry) => entry.t === 'secondary',
  melee: (entry) => entry.t === 'melee',
};

export function HomeSearch({ counts }: { counts: Readonly<Record<Scope, number>> }) {
  const [scope, setScope] = useState<Scope>('all');
  const current = SCOPES.find((s) => s.scope === scope)!;
  const filter = useMemo(() => FILTERS[scope], [scope]);

  return (
    <div className="console">
      <WeaponSearch
        variant="hero"
        filter={filter}
        placeholder={`Type a weapon name: ${counts[scope]} ${current.noun}`}
        label={`Search ${current.noun}`}
      />
      <div className="scope-tabs console__scopes" role="group" aria-label="What to search">
        {SCOPES.map(({ scope: candidate, label, icon }) => (
          <button
            key={candidate}
            type="button"
            className="scope-tab"
            aria-pressed={scope === candidate}
            onClick={() => setScope(candidate)}
          >
            <Icon name={icon} size={16} />
            {label}
            <span className="scope-tab__count">{counts[candidate]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
