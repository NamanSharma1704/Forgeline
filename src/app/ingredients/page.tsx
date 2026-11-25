import type { Metadata } from 'next';
import { ScreenHeader, Telemetry } from '@/components/shell/ScreenHeader';
import { IngredientIndex, type IngredientRow } from '@/components/IngredientIndex';
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
      builds,
      totalCopies: builds.reduce((n, build) => n + build.copies, 0),
    };
  });

  return (
    <>
      <ScreenHeader
        title="Ingredients"
        context={`${rows.length} weapons you should think twice about selling: each one goes into another weapon's recipe.`}
        telemetry={<Telemetry label="Weapons" value={rows.length} />}
      />
      <IngredientIndex rows={rows} />
    </>
  );
}
