import Link from 'next/link';
import { HomeArsenalStats, SweepFigure } from '@/components/HomeArsenalStats';
import { HomeSearch, type QuickPick } from '@/components/HomeSearch';
import { Icon } from '@/components/Icon';
import { WeaponArt } from '@/components/WeaponArt';
import { allWeapons, getWeapon, ingredientWeapons, newWeapons, weaponsInSlot } from '@/data/weapons';

/** Weapons players check most, the ingredients they meet first (design plan 3.3). */
const QUICK = ['bolto', 'lato', 'dual-skana', 'broken-war'];

/**
 * The home page, the terminal deck (design plan 3): the question, the search console with its
 * category strip and quick picks, the three tools with their figures, and the player's own
 * numbers once there are any. Spec 5.1 still holds: the search is the first thing to use.
 */
export default function HomePage() {
  const fresh = newWeapons();
  const total = allWeapons().length;
  const ingredientCount = ingredientWeapons().length;
  const counts = {
    all: total,
    ingredients: ingredientCount,
    primary: weaponsInSlot('primary').length,
    secondary: weaponsInSlot('secondary').length,
    melee: weaponsInSlot('melee').length,
  };
  const quick: QuickPick[] = QUICK.flatMap((slug) => {
    const weapon = getWeapon(slug);
    return weapon ? [{ slug, name: weapon.name, slot: weapon.slot, image: weapon.image, thumb: weapon.thumb }] : [];
  });

  return (
    <div className="home">
      <header className="home-hero">
        <p className="eyebrow">
          <span className="eyebrow__pulse" aria-hidden="true" />
          {/* One run of text, so it wraps as a line on a phone rather than as columns. */}
          <span>
            Tenno Foundry Command{' '}
            <span className="eyebrow__sep" aria-hidden="true">
              {'//'}
            </span>{' '}
            {total} weapons indexed
          </span>
        </p>
        <h1 className="page-title home-hero__title">Can I sell this?</h1>
        <p className="lede home-hero__lede">
          Instant sell-safe verdicts for every Warframe weapon. Keep what you need. Free the slots you
          don&apos;t. Plan your next build.
        </p>
        <div className="home-hero__rule" aria-hidden="true" />
      </header>

      <HomeSearch counts={counts} quick={quick} />

      <div className="tool-cards">
        <Link href="/ingredients/" className="tool-card shape">
          <span className="tool-card__head">
            <Icon name="blueprint" size={22} className="tool-card__icon" />
            <span className="eyebrow eyebrow--inline">Catalog</span>
          </span>
          <h2 className="tool-card__title">Ingredient Index</h2>
          <p className="tool-card__lede">
            Every weapon another recipe consumes, with what it builds and how many copies.
          </p>
          <span className="tool-card__figure telemetry">
            {ingredientCount} <small>core weapons</small>
          </span>
          <span className="tool-card__cta">
            View index <Icon name="arrow-right" size={14} />
          </span>
        </Link>

        <Link href="/sweep/" className="tool-card shape">
          <span className="tool-card__head">
            <Icon name="slots" size={22} className="tool-card__icon" />
            <span className="eyebrow eyebrow--inline">Inventory</span>
          </span>
          <h2 className="tool-card__title">Slot Sweep</h2>
          <p className="tool-card__lede">
            What you hold, sorted into what can go and what must stay, each with its reason.
          </p>
          <SweepFigure />
          <span className="tool-card__cta">
            Sweep now <Icon name="arrow-right" size={14} />
          </span>
        </Link>

        <Link href="/plan/" className="tool-card shape">
          <span className="tool-card__head">
            <Icon name="queue" size={22} className="tool-card__icon" />
            <span className="eyebrow eyebrow--inline">Foundry</span>
          </span>
          <h2 className="tool-card__title">Build Planner</h2>
          <p className="tool-card__lede">
            Every weapon down the chain, the stages to queue, the hours and the resources.
          </p>
          <span className="tool-card__figure tool-card__figure--quiet telemetry">Plan any build</span>
          <span className="tool-card__cta">
            Open planner <Icon name="arrow-right" size={14} />
          </span>
        </Link>
      </div>

      <HomeArsenalStats />

      {fresh.length > 0 && (
        <section className="section" aria-labelledby="new-weapons-title">
          <h2 id="new-weapons-title" className="section-title">
            New this month
          </h2>
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
    </div>
  );
}
