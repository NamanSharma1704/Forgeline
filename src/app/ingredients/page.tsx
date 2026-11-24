import type { Metadata } from 'next';
import { IngredientIndex, type IngredientRow } from '@/components/IngredientIndex';
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
      slot: weapon.slot,
      image: weapon.image,
      thumb: weapon.thumb,
      builds,
      totalCopies: builds.reduce((n, build) => n + build.copies, 0),
    };
  });

  return (
    <>
      <h1 className="page-title">{rows.length} weapons you should think twice about selling</h1>
      <p className="lede">
        Each one is consumed by at least one other weapon&apos;s recipe. The copy count is what that
        one recipe needs, so a weapon feeding two recipes can be worth keeping more than once.
      </p>
      <IngredientIndex rows={rows} />
    </>
  );
}
