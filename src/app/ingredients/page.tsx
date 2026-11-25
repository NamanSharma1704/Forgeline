import type { Metadata } from 'next';
import { ScreenHeader, Telemetry } from '@/components/shell/ScreenHeader';
import { IngredientIndex, type IngredientRow } from '@/components/IngredientIndex';
import type { TileWeapon } from '@/components/parts/ArsenalTile';
import { variantOf } from '@/data/variants';
import { ingredientWeapons, resolve } from '@/data/weapons';

export const metadata: Metadata = {
  title: 'Ingredient weapons',
  description:
    'Every Warframe weapon that is an ingredient in another weapon recipe, with what it builds and how many copies each recipe needs.',
};

export default function IngredientsPage() {
  const rows: IngredientRow[] = ingredientWeapons().map((weapon) => {
    const builds = weapon.usedToBuild.map((edge) => ({
      slug: edge.slug,
      name: resolve(edge.slug).name,
      copies: edge.copies,
    }));
    return {
      slug: weapon.slug,
      name: weapon.name,
      variant: variantOf(weapon.name).variant,
      slot: weapon.slot,
      image: weapon.image,
      thumb: weapon.thumb,
      mr: weapon.masteryReq,
      // Made from weapons and used in a later recipe: a step in the middle of a chain.
      intermediate: weapon.madeFrom.length > 0,
      builds,
      totalCopies: builds.reduce((n, build) => n + build.copies, 0),
    };
  });

  // Tiles for what they build, for the inspect panel.
  const catalogue: TileWeapon[] = [
    ...new Map(
      ingredientWeapons()
        .flatMap((weapon) => weapon.usedToBuild)
        .map((edge) => {
          const target = resolve(edge.slug);
          const tile: TileWeapon = {
            slug: target.slug,
            name: target.name,
            slot: target.slot,
            image: target.image,
            thumb: target.thumb,
            mr: target.masteryReq,
          };
          return [tile.slug, tile] as const;
        })
    ).values(),
  ];

  return (
    <>
      <ScreenHeader
        title="Ingredients"
        context={`${rows.length} weapons you should think twice about selling: each one goes into another weapon's recipe.`}
        telemetry={<Telemetry label="Weapons" value={rows.length} />}
      />
      <IngredientIndex rows={rows} catalogue={catalogue} />
    </>
  );
}
