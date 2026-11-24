import Link from 'next/link';
import { WeaponArt } from '@/components/WeaponArt';
import { WeaponSearch } from '@/components/WeaponSearch';
import { ingredientWeapons, newWeapons } from '@/data/weapons';

/** Spec 5.1: the home page is a single search box. */
export default function HomePage() {
  const fresh = newWeapons();
  const ingredientCount = ingredientWeapons().length;

  return (
    <div className="home">
      <h1 className="page-title">Can I sell this?</h1>
      <p className="lede">
        Type the weapon you are about to sell. Forgeline shows what it builds, how many copies the
        recipe needs, and whether you can let it go.
      </p>

      <WeaponSearch variant="hero" />

      <p className="search-hint">
        Try <Link href="/w/bolto/">Bolto</Link>, <Link href="/w/lato/">Lato</Link> or{' '}
        <Link href="/w/dual-skana/">Dual Skana</Link>.
      </p>

      {fresh.length > 0 && (
        <section className="section">
          <h2 className="section-title">New this month</h2>
          <ul className="strip">
            {fresh.map((weapon) => (
              <li key={weapon.slug}>
                <Link href={`/w/${weapon.slug}/`} className="tree-box shape">
                  <WeaponArt weapon={weapon} size="medium" />
                  <span className="tree-box__name">{weapon.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section prose">
        <h2>{ingredientCount} weapons feed other recipes</h2>
        <p>
          The game never warns you before you sell one, and you usually find out weeks later when a
          blueprint asks for it. <Link href="/ingredients/">See every ingredient weapon</Link>, what
          it builds and how many copies each recipe needs.
        </p>
      </section>
    </div>
  );
}
