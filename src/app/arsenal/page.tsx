import type { Metadata } from 'next';
import { ArsenalManager, type ArsenalRow, type RecipeRole } from '@/components/ArsenalManager';
import type { Weapon } from '@/data/types';
import { variantOf } from '@/data/variants';
import { allWeapons, getWeapon } from '@/data/weapons';

export const metadata: Metadata = {
  title: 'My Arsenal',
  description:
    'Mark the Warframe weapons you own and have mastered, so every sell check on Forgeline is about your own arsenal. Saved in your browser, no account needed.',
};

/**
 * Weapons new players commonly start with. The player taps the ones they picked rather than the
 * site asserting which choices the tutorial offered.
 */
const STARTER_SLUGS = ['mk1-braton', 'mk1-paris', 'lato', 'mk1-furis', 'mk1-kunai', 'skana', 'mk1-bo', 'mk1-furax'];

const role = (weapon: Weapon): RecipeRole => {
  const ingredient = weapon.usedToBuild.length > 0;
  const target = weapon.madeFrom.length > 0;
  return ingredient && target ? 'both' : ingredient ? 'ingredient' : target ? 'target' : 'none';
};

const toRow = (weapon: Weapon): ArsenalRow => ({
  slug: weapon.slug,
  name: weapon.name,
  slot: weapon.slot,
  image: weapon.image,
  thumb: weapon.thumb,
  role: role(weapon),
  masteryReq: weapon.masteryReq,
  variant: variantOf(weapon.name).variant,
});

export default function ArsenalPage() {
  const rows = allWeapons().map(toRow);
  const starters = STARTER_SLUGS.flatMap((slug) => {
    const weapon = getWeapon(slug);
    return weapon ? [toRow(weapon)] : [];
  });

  return (
    <>
      <h1 className="page-title">My Arsenal</h1>
      <p className="lede">
        Mark what you own and what you have mastered. It stays in this browser, no account needed,
        and every verdict on the site follows it.
      </p>
      <ArsenalManager rows={rows} starters={starters} />
    </>
  );
}
