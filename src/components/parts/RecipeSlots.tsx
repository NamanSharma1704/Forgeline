'use client';

import type { RecipeSummary } from '@/data/recipe';
import { DECAYING_RESOURCES, RARE_RESOURCES } from '@/data/resources';
import { isArsenalSetUp } from '@/engine';
import { recipeCosts } from '@/format/recipe';
import { statusIn } from '@/store/arsenal';
import { useArsenal } from '@/store/useArsenal';
import type { ArtWeapon } from '../WeaponArt';
import { FoundrySlot } from './FoundrySlot';

/**
 * One recipe as a row of Foundry slots (design plan 2.2, pillar 4): its weapons first, each with
 * what the player holds against what one build needs once their arsenal is set up, then the
 * blueprint, parts and resources with the amount needed (resources are not tracked, so they never
 * show a "have"), and the credits and Foundry time underneath.
 */

/** Blueprint, then the weapon's own parts, then shared resources; source order within each. */
const KIND_ORDER = { blueprint: 0, part: 1, resource: 2 } as const;

export function RecipeSlots({
  recipe,
  art,
}: {
  recipe: RecipeSummary;
  /** Pictures for the recipe's weapons, by slug. */
  art: Readonly<Record<string, ArtWeapon>>;
}) {
  const { ready, arsenal } = useArsenal();
  const known = ready && isArsenalSetUp(arsenal.entries);
  const held = (slug: string) => {
    if (!known) return undefined;
    const status = statusIn(arsenal, slug);
    return status === 'owned' || status === 'mastered' ? (arsenal.entries[slug]?.qty ?? 1) : 0;
  };
  const materials = [...recipe.materials].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  const costs = recipeCosts(recipe);

  return (
    <>
      <ul className="recipe-slots">
        {recipe.weapons.map((weapon) => (
          <li key={`weapon-${weapon.slug}`}>
            <FoundrySlot
              name={weapon.name}
              art={art[weapon.slug]}
              icon="blueprint"
              need={weapon.copies}
              have={held(weapon.slug)}
              href={`/w/${weapon.slug}/`}
            />
          </li>
        ))}
        {materials.map((material) => (
          <li key={`${material.kind}-${material.name}`}>
            <FoundrySlot
              name={material.name}
              icon={material.kind === 'resource' ? 'diamond' : 'blueprint'}
              need={material.count}
              tag={
                material.kind !== 'resource'
                  ? undefined
                  : DECAYING_RESOURCES.has(material.name)
                    ? 'Decays daily'
                    : RARE_RESOURCES.has(material.name)
                      ? 'Rare'
                      : undefined
              }
            />
          </li>
        ))}
      </ul>
      {costs.length > 0 && (
        <p className="recipe-costs">{costs.join(' · ').replace(/^./, (c) => c.toUpperCase())}</p>
      )}
    </>
  );
}
