import Link from 'next/link';
import { WeaponArt } from '@/components/WeaponArt';
import { allWeapons, ingredientWeapons, resolve, weaponIndex } from '@/data/weapons';
import { SLOT_LABEL } from '@/data/types';

/** Weapons worth putting in front of someone who has just arrived. */
const EXAMPLES = ['bolto', 'dual-skana', 'lato'];

export default function HomePage() {
  const ingredients = ingredientWeapons();
  const newThisMonth = allWeapons().filter((weapon) => weapon.isNew);

  return (
    <>
      <p className="eyebrow">Warframe sell check</p>
      <h1>Can I sell this?</h1>
      <p className="lede">
        {ingredients.length} weapons in Warframe are ingredients in another weapon&apos;s recipe, and
        the game never warns you before you sell one. Look a weapon up here to see what it builds,
        how many copies that recipe needs, and whether you still need it.
      </p>

      <ul className="stats">
        <li className="stat">
          <div className="stat__value">{weaponIndex.counts.weapons}</div>
          <div className="stat__label">weapons tracked</div>
        </li>
        <li className="stat">
          <div className="stat__value">{ingredients.length}</div>
          <div className="stat__label">are recipe ingredients</div>
        </li>
        <li className="stat">
          <div className="stat__value">{weaponIndex.counts.craftable}</div>
          <div className="stat__label">built from other weapons</div>
        </li>
      </ul>

      {newThisMonth.length > 0 && (
        <section className="section">
          <h2>New this month</h2>
          <ul className="weapon-grid">
            {newThisMonth.map((weapon) => (
              <li key={weapon.slug}>
                <Link href={`/w/${weapon.slug}/`} className="weapon-card">
                  <WeaponArt weapon={weapon} />
                  <span>
                    <span className="weapon-card__name">{weapon.name}</span>
                    <span className="weapon-card__meta"> {SLOT_LABEL[weapon.slot]}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <h2>Start with one of these</h2>
        <ul className="weapon-grid">
          {EXAMPLES.map((slug) => {
            const weapon = resolve(slug);
            const builds = weapon.usedToBuild.map(
              (edge) => `${resolve(edge.slug).name} (${edge.copies})`
            );
            return (
              <li key={slug}>
                <Link href={`/w/${slug}/`} className="weapon-card">
                  <WeaponArt weapon={weapon} priority />
                  <span>
                    <span className="weapon-card__name">{weapon.name}</span>
                    <br />
                    <span className="weapon-card__meta">builds {builds.join(', ')}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="section">
        <h2>Every ingredient weapon</h2>
        <p className="lede">
          The full list of weapons that feed another recipe, with what each one builds and how many
          copies it takes.
        </p>
        <p>
          <Link href="/ingredients/">Open the ingredient index</Link>
        </p>
      </section>
    </>
  );
}
