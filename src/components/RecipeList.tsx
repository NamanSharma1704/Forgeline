import Link from 'next/link';
import type { RecipeSummary } from '@/data/recipe';
import { DECAYING_RESOURCES, RARE_RESOURCES } from '@/data/resources';
import { recipeCosts } from '@/format/recipe';

/**
 * One weapon's recipe (M6.5, 12.7): weapon ingredients first, then blueprint, parts and resources,
 * with the resources a player is likely to be short of tagged, and what the build costs in credits
 * and Foundry time underneath. The weapon page shows it in full; the verdict card's peek shows the
 * compact form, so a player can see what a target takes without leaving the card.
 */

const count = (n: number) => n.toLocaleString('en-GB');

/** Blueprint, then the weapon's own parts, then shared resources; source order within each. */
const KIND_ORDER = { blueprint: 0, part: 1, resource: 2 } as const;

interface Item {
  readonly key: string;
  readonly kind: string;
  readonly label: React.ReactNode;
  readonly count: number;
  readonly rare?: boolean;
  readonly decays?: boolean;
}

function Tags({ item }: { item: Item }) {
  return (
    <>
      {item.rare && <span className="tag tag--rare">Rare</span>}
      {item.decays && <span className="tag tag--decays">Decays daily</span>}
    </>
  );
}

export function RecipeList({ recipe, compact = false }: { recipe: RecipeSummary; compact?: boolean }) {
  const items: Item[] = [
    ...recipe.weapons.map((weapon) => ({
      key: `weapon-${weapon.slug}`,
      kind: 'weapon',
      label: <Link href={`/w/${weapon.slug}/`}>{weapon.name}</Link>,
      count: weapon.copies,
    })),
    ...[...recipe.materials].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]).map((material) => ({
      key: `${material.kind}-${material.name}`,
      kind: material.kind,
      label: material.name,
      count: material.count,
      rare: material.kind === 'resource' && RARE_RESOURCES.has(material.name),
      decays: material.kind === 'resource' && DECAYING_RESOURCES.has(material.name),
    })),
  ];
  const costs = recipeCosts(recipe);
  const costLine = costs.length > 0 && (
    <p className="recipe-costs">{costs.join(' · ').replace(/^./, (c) => c.toUpperCase())}</p>
  );

  if (compact) {
    return (
      <>
        <ul className="recipe-peek__list">
          {items.map((item) => (
            <li key={item.key} data-kind={item.kind}>
              <span className="recipe-peek__count">{count(item.count)}</span> {item.label}
              <Tags item={item} />
            </li>
          ))}
        </ul>
        {costLine}
      </>
    );
  }

  return (
    <>
      <ul className="resource-list resource-list--recipe">
        {items.map((item) => (
          <li key={item.key} data-kind={item.kind}>
            <span>
              {item.label}
              <Tags item={item} />
            </span>
            <span className="resource-list__count">{count(item.count)}</span>
          </li>
        ))}
      </ul>
      {costLine}
    </>
  );
}
