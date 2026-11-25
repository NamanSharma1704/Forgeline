import type { Metadata } from 'next';
import { ArsenalTile, type TileWeapon } from '@/components/parts/ArsenalTile';
import { CodexFrame } from '@/components/parts/CodexFrame';
import { FoundrySlot } from '@/components/parts/FoundrySlot';
import { Ledger } from '@/components/parts/Ledger';
import { DiamondNode, DiamondRule } from '@/components/parts/marks';
import { TileGrid } from '@/components/parts/TileGrid';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import type { Weapon } from '@/data/types';
import { getWeapon, resolve } from '@/data/weapons';

/**
 * Every shared part of the Warframe-native interface (design plan section 11), in each of its
 * states, so they can be checked before the screens are built from them. Not linked from the site,
 * and kept out of search engines.
 */
export const metadata: Metadata = {
  title: 'Interface parts',
  robots: { index: false, follow: false },
};

const tile = (weapon: Weapon): TileWeapon => ({
  slug: weapon.slug,
  name: weapon.name,
  slot: weapon.slot,
  image: weapon.image,
  thumb: weapon.thumb,
  mr: weapon.masteryReq,
});
const pick = (slugs: readonly string[]) => slugs.flatMap((slug) => {
  const weapon = getWeapon(slug);
  return weapon ? [tile(weapon)] : [];
});

const GRID = [
  'lato', 'bolto', 'akbolto', 'akjagara', 'hystrix', 'dual-skana', 'broken-war',
  'braton-prime', 'kuva-bramma', 'hate', 'artax', 'deth-machine-rifle-prime',
];

export default function LabPage() {
  const [bolto, hate, kuva, artax, deth] = pick(['bolto', 'hate', 'kuva-bramma', 'artax', 'deth-machine-rifle-prime']);
  const grid = pick(GRID);
  const catalogue = [
    ...new Map(
      grid.flatMap((weapon) => resolve(weapon.slug).usedToBuild.map((edge) => tile(resolve(edge.slug)))).map((t) => [t.slug, t])
    ).values(),
  ];
  const lato = pick(['lato'])[0]!;

  return (
    <>
      <ScreenHeader
        title="Interface parts"
        context="Every shared part of the Warframe-native design, in each of its states. Not linked from the site."
      />

      <section className="section lab" aria-labelledby="lab-tiles">
        <h2 id="lab-tiles" className="section-title">
          Arsenal tiles
        </h2>
        <p className="lab__note">Large, medium and small; then rest, mastered, favourite with copies held, new, sold and selected.</p>
        <div className="lab__row">
          <div className="lab__cell" style={{ width: 260 }}>
            <ArsenalTile weapon={bolto!} size="large" status="mastered" favourite count={2} />
          </div>
          <div className="lab__cell" style={{ width: 168 }}>
            <ArsenalTile weapon={bolto!} size="medium" status="mastered" favourite count={2} />
          </div>
          <div className="lab__cell" style={{ width: 112 }}>
            <ArsenalTile weapon={bolto!} size="small" status="mastered" favourite count={2} />
          </div>
        </div>
        <div className="lab__row">
          {[
            { label: 'Rest', node: <ArsenalTile weapon={hate!} href="/w/hate/" /> },
            { label: 'Mastered', node: <ArsenalTile weapon={kuva!} href="/w/kuva-bramma/" status="mastered" /> },
            { label: 'Favourite, two held', node: <ArsenalTile weapon={lato} status="owned" favourite count={2} /> },
            { label: 'New', node: <ArsenalTile weapon={artax!} isNew /> },
            { label: 'Sold', node: <ArsenalTile weapon={deth!} status="sold" /> },
            { label: 'Selected', node: <ArsenalTile weapon={bolto!} selected /> },
          ].map(({ label, node }) => (
            <figure key={label} className="lab__cell" style={{ width: 168 }}>
              {node}
              <figcaption>{label}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="section lab" aria-labelledby="lab-codex">
        <h2 id="lab-codex" className="section-title">
          Codex frame and ledger
        </h2>
        <div className="lab__pair">
          <CodexFrame weapon={bolto!} />
          <Ledger
            rows={[
              { label: 'Slot', value: 'Secondary' },
              { label: 'Mastery rank', value: 'MR 7', tone: 'gold' },
              { label: 'Foundry', value: '12 h' },
              { label: 'Added in', value: 'Vanilla' },
              { label: 'Ingredient for', value: '2 recipes' },
            ]}
          />
        </div>
      </section>

      <section className="section lab" aria-labelledby="lab-slots">
        <h2 id="lab-slots" className="section-title">
          Foundry slots
        </h2>
        <p className="lab__note">Weapons show have and need from the arsenal; resources show only what is needed.</p>
        <ul className="lab__slots">
          <li>
            <FoundrySlot name="Lato" art={lato} need={1} have={1} href="/w/lato/" />
          </li>
          <li>
            <FoundrySlot name="Bolto" art={bolto!} need={2} have={0} href="/w/bolto/" />
          </li>
          <li>
            <FoundrySlot name="Blueprint" icon="blueprint" need={1} />
          </li>
          <li>
            <FoundrySlot name="Polymer Bundle" need={800} />
          </li>
          <li>
            <FoundrySlot name="Credits" icon="credits" need={20000} />
          </li>
        </ul>
      </section>

      <section className="section lab" aria-labelledby="lab-marks">
        <h2 id="lab-marks" className="section-title">
          Marks
        </h2>
        <div className="lab__row lab__marks">
          <DiamondNode />
          <DiamondNode tone="steel" />
          <div className="lab__rule">
            <DiamondRule />
          </div>
          <div className="lab__frame shape shape--frame">Bracketed frame</div>
        </div>
      </section>

      <section className="section lab" aria-labelledby="lab-grid">
        <h2 id="lab-grid" className="section-title">
          Select, then inspect
        </h2>
        <p className="lab__note">
          Click or use the arrow keys to select; click again or press Enter to open the dossier; Esc closes the panel.
        </p>
        <TileGrid weapons={grid} catalogue={catalogue} label="Weapons to inspect" />
      </section>
    </>
  );
}
