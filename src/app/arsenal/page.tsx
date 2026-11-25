import type { Metadata } from 'next';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { ArsenalManager, type ArsenalRow, type RecipeRole } from '@/components/ArsenalManager';
import { shareMetadata } from '@/data/site';
import type { Weapon } from '@/data/types';
import { variantOf } from '@/data/variants';
import { allWeapons, getWeapon } from '@/data/weapons';

const title = 'My Arsenal';
const description =
  'Mark the Warframe weapons you own and have mastered, so every sell check on Forgeline is about your own arsenal. Saved in your browser, no account needed.';

export const metadata: Metadata = {
  title,
  description,
  ...shareMetadata({ title, description, path: '/arsenal/' }),
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
      <ScreenHeader
        title="My Arsenal"
        context="What you own and what you have mastered. Saved in this browser; every verdict on the site follows it."
      />
      <ArsenalManager rows={rows} starters={starters} />
    </>
  );
}
