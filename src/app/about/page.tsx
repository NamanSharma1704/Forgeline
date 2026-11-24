import type { Metadata } from 'next';
import { weaponIndex } from '@/data/weapons';

export const metadata: Metadata = {
  title: 'About the data',
  description:
    'Where Forgeline gets its weapon recipes and pictures, how often they refresh, and how to report a mistake.',
};

export default function AboutPage() {
  return (
    <div className="prose">
      <h1 className="page-title">Where this data comes from</h1>

      <h2>Source</h2>
      <p>
        Recipes, weapon names, mastery ranks and pictures come from{' '}
        <a href="https://github.com/wfcd/warframe-items">
          <code>@wfcd/items</code>
        </a>
        , an open-source package maintained by the Warframe Community Developers and built from
        Digital Extremes&apos; public game data export. This build used version{' '}
        {weaponIndex.sourceVersion}.
      </p>

      <h2>How it is built</h2>
      <p>
        A script reads the weapon files, keeps every recipe component that is itself a weapon, adds
        up the copy counts, and writes one index the site is built from. Pictures are downloaded
        during the same build and converted to WebP in two sizes, then served from Forgeline&apos;s
        own hosting rather than someone else&apos;s server.
      </p>
      <p>
        It runs once a month. This build is from{' '}
        <time dateTime={weaponIndex.generatedAt}>{weaponIndex.generatedAt.slice(0, 10)}</time> and
        covers {weaponIndex.counts.weapons} weapons, of which {weaponIndex.counts.ingredients} are
        ingredients in another recipe. The newest weapon in this data arrived in{' '}
        {weaponIndex.newestWeaponUpdate}.
      </p>

      <h2>What it leaves out</h2>
      <p>
        Only weapons are tracked. Warframes, companions and Archwing parts have recipes of their
        own, but no weapon recipe consumes one, so leaving them out cannot make a sell check wrong.
        Resources such as Orokin Cells are part of a recipe but are not tracked. Modular weapons
        (Zaws, Kitguns) are left out because their parts are not weapons you sell.
      </p>

      <h2>Found a mistake?</h2>
      <p>
        Recipes change with game updates, and a wrong answer here could cost you a farm. Please
        report anything that looks off by opening an issue on{' '}
        <a href="https://github.com/NamanSharma1704/Forgeline/issues">the Forgeline repository</a>,
        naming the weapon and what you expected.
      </p>

      <h2>Legal</h2>
      <p>
        Forgeline is free, has no adverts and is not affiliated with or endorsed by Digital
        Extremes. Warframe is a trademark of Digital Extremes Ltd. Weapon pictures are Digital
        Extremes&apos; game assets, used here under the non-commercial terms of the Warframe
        Content Policy.
      </p>
    </div>
  );
}
