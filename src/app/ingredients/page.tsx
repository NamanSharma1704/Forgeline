import type { Metadata } from 'next';
import Link from 'next/link';
import { WeaponArt } from '@/components/WeaponArt';
import { ingredientWeapons, resolve } from '@/data/weapons';
import { SLOT_LABEL } from '@/data/types';

export const metadata: Metadata = {
  title: 'Ingredient weapons',
  description:
    'Every Warframe weapon that is an ingredient in another weapon recipe, with what it builds and how many copies each recipe needs.',
};

export default function IngredientsPage() {
  const ingredients = ingredientWeapons();

  return (
    <>
      <p className="eyebrow">Ingredient index</p>
      <h1>{ingredients.length} weapons you should think twice about selling</h1>
      <p className="lede">
        Each of these is consumed by at least one other weapon&apos;s recipe. The copy count is how
        many that single recipe needs, so a weapon feeding two recipes can be worth keeping more than
        one of.
      </p>

      <div className="table-wrap section">
        <table>
          <thead>
            <tr>
              <th scope="col">Weapon</th>
              <th scope="col">Slot</th>
              <th scope="col">Used to build</th>
            </tr>
          </thead>
          <tbody>
            {ingredients.map((weapon) => (
              <tr key={weapon.slug}>
                <th scope="row">
                  <Link href={`/w/${weapon.slug}/`} className="cell-weapon">
                    <WeaponArt weapon={weapon} />
                    {weapon.name}
                  </Link>
                </th>
                <td className="muted">{SLOT_LABEL[weapon.slot]}</td>
                <td>
                  {weapon.usedToBuild.map((edge, i) => (
                    <span key={edge.slug}>
                      {i > 0 && ', '}
                      <Link href={`/w/${edge.slug}/`}>{resolve(edge.slug).name}</Link>
                      <span className="copies"> ({edge.copies})</span>
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
