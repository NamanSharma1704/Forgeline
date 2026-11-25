import Link from 'next/link';
import { MasteredFigure, SweepFigure } from '@/components/HomeArsenalStats';
import { HomeSearch } from '@/components/HomeSearch';
import { Icon, type IconName } from '@/components/Icon';
import type { TileWeapon } from '@/components/parts/ArsenalTile';
import { LiveTile } from '@/components/parts/LiveTile';
import { RecentChecks } from '@/components/parts/RecentChecks';
import { ScreenHeader, Telemetry } from '@/components/shell/ScreenHeader';
import type { Weapon } from '@/data/types';
import { allWeapons, getWeapon, ingredientWeapons, newWeapons, weaponsInSlot } from '@/data/weapons';

/** Weapons players check most, the ingredients they meet first. */
const FIRST_CHECKS = ['bolto', 'lato', 'dual-skana', 'broken-war'];

const toTile = (weapon: Weapon): TileWeapon => ({
  slug: weapon.slug,
  name: weapon.name,
  slot: weapon.slot,
  image: weapon.image,
  thumb: weapon.thumb,
  mr: weapon.masteryReq,
});

/** A segment launcher (design plan 5): one panel per screen, with one live figure and Open. */
function Launcher({
  href,
  icon,
  title,
  figure,
}: {
  href: string;
  icon: IconName;
  title: string;
  figure: React.ReactNode;
}) {
  return (
    <Link href={href} className="launcher shape shape--frame">
      <Icon name={icon} size={24} className="launcher__icon" />
      <span className="launcher__title">{title}</span>
      {figure}
      <span className="launcher__open" aria-hidden="true">
        Open
        <Icon name="arrow-right" size={14} />
      </span>
    </Link>
  );
}

/**
 * Home, the Orbiter console (design plan 5). The question as the screen's title and the search
 * under it, first: checking a weapon in five seconds is still the job. Then, side by side on a
 * wide screen, the quick-check grid (first checks, weapons new this month, and those recently
 * checked in this browser) and the four screens as launchers with their live figures. No
 * marketing copy, no feature cards.
 */
export default function HomePage() {
  const total = allWeapons().length;
  const ingredientCount = ingredientWeapons().length;
  const recipeCount = allWeapons().filter((weapon) => (weapon.materials?.length ?? 0) > 0 || weapon.madeFrom.length > 0).length;
  const counts = {
    all: total,
    ingredients: ingredientCount,
    primary: weaponsInSlot('primary').length,
    secondary: weaponsInSlot('secondary').length,
    melee: weaponsInSlot('melee').length,
  };
  const first = FIRST_CHECKS.flatMap((slug) => {
    const weapon = getWeapon(slug);
    return weapon ? [toTile(weapon)] : [];
  });
  const fresh = newWeapons().map(toTile);

  return (
    <div className="console-screen">
      <ScreenHeader title="Can I sell this?" telemetry={<Telemetry label="Indexed" value={total} />} />
      <HomeSearch counts={counts} />

      <div className="console-grid">
        <div className="console-grid__main">
          <section className="console__shelf" aria-labelledby="first-checks">
            <h2 id="first-checks" className="section-title">
              First checks
            </h2>
            <ul className="tile-row">
              {first.map((weapon) => (
                <li key={weapon.slug}>
                  <LiveTile weapon={weapon} href={`/w/${weapon.slug}/`} />
                </li>
              ))}
            </ul>
          </section>

          {fresh.length > 0 && (
            <section className="console__shelf" aria-labelledby="new-weapons">
              <h2 id="new-weapons" className="section-title">
                New this month
              </h2>
              <ul className="tile-row">
                {fresh.map((weapon) => (
                  <li key={weapon.slug}>
                    <LiveTile weapon={weapon} href={`/w/${weapon.slug}/`} isNew />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <RecentChecks />
        </div>

        <section className="launchers" aria-label="Screens and your figures">
          <Launcher href="/arsenal/" icon="slots" title="My Arsenal" figure={<MasteredFigure total={total} />} />
          <Launcher href="/sweep/" icon="sell" title="Slot Sweep" figure={<SweepFigure />} />
          <Launcher
            href="/plan/"
            icon="queue"
            title="Foundry"
            figure={
              <span className="launcher__figure">
                <strong>{recipeCount}</strong> recipes to plan
              </span>
            }
          />
          <Launcher
            href="/ingredients/"
            icon="blueprint"
            title="Ingredients"
            figure={
              <span className="launcher__figure">
                <strong>{ingredientCount}</strong> ingredient weapons
              </span>
            }
          />
        </section>
      </div>
    </div>
  );
}
