'use client';

import { QtyStepper } from './QtyStepper';
import { StatusPicker } from './StatusPicker';

/** The player's own status for the weapon on its page, and copies held if it is an ingredient. */
export function WeaponStatus({
  slug,
  name,
  isIngredient,
}: {
  slug: string;
  name: string;
  isIngredient: boolean;
}) {
  return (
    <div className="weapon-status">
      <span className="weapon-status__label">Your {name}</span>
      <div className="weapon-status__controls">
        <StatusPicker slug={slug} name={name} />
        {isIngredient && <QtyStepper slug={slug} name={name} />}
      </div>
    </div>
  );
}
