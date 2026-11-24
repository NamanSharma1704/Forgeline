import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FamilyTree, type TreeWeapon } from '@/components/FamilyTree';
import { PersonalVerdict } from '@/components/PersonalVerdict';
import type { CardTarget } from '@/components/VerdictCard';
import { WeaponArt } from '@/components/WeaponArt';
import { WeaponStatus } from '@/components/WeaponStatus';
import { recipeGraph } from '@/data/engine';
import { SLOT_LABEL, type Weapon } from '@/data/types';
import { allWeapons, getWeapon, resolve } from '@/data/weapons';
import { createEvaluator, explain, familyTree } from '@/engine';

type Params = { slug: string };

/** One static page per weapon: 621 today, pre-rendered with their verdict and tree in the HTML. */
export function generateStaticParams(): Params[] {
  return allWeapons().map((weapon) => ({ slug: weapon.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const weapon = getWeapon(slug);
  if (!weapon) return { title: 'Unknown weapon' };
  const builds = weapon.usedToBuild.map((edge) => resolve(edge.slug).name);
  return {
    title: `${weapon.name}: can I sell it?`,
    description: builds.length
      ? `${weapon.name} is used to build ${builds.join(' and ')}. Check before you sell it.`
      : `${weapon.name} is not used in any weapon recipe, so selling it costs no future build.`,
  };
}

const toCard = (weapon: Weapon): CardTarget => ({
  slug: weapon.slug,
  name: weapon.name,
  slot: weapon.slot,
  image: weapon.image,
  thumb: weapon.thumb,
});

const toTree = (weapon: Weapon): TreeWeapon => ({
  ...toCard(weapon),
  builds: weapon.usedToBuild.map((edge) => resolve(edge.slug).name),
});

// Pages are pre-rendered with the empty-arsenal verdict: Check for the 46 ingredients, Safe for the
// rest. PersonalVerdict re-renders the card in the browser once the player has an arsenal.
const evaluator = createEvaluator(recipeGraph, {});

/** Every weapon reachable forward from this one, so any personal chain can be named. */
function descendants(slug: string): string[] {
  const seen = new Set<string>([slug]);
  const queue = [slug];
  while (queue.length) {
    for (const edge of resolve(queue.shift()!).usedToBuild) {
      if (!seen.has(edge.slug)) {
        seen.add(edge.slug);
        queue.push(edge.slug);
      }
    }
  }
  return [...seen];
}

export default async function WeaponPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const weapon = getWeapon(slug);
  if (!weapon) notFound();

  const verdict = evaluator.verdict(slug);
  const explanation = explain(verdict, recipeGraph);
  const targets = verdict.targets.map((target) => toCard(resolve(target.slug)));
  const names = Object.fromEntries(descendants(slug).map((s) => [s, resolve(s).name]));

  const tree = familyTree(recipeGraph, slug, { depth: 1 });
  const madeFrom = tree.madeFrom.map((node) => ({
    weapon: toTree(resolve(node.slug)),
    copies: node.copies,
  }));
  const usedToBuild = tree.usedToBuild.map((node) => ({
    weapon: toTree(resolve(node.slug)),
    copies: node.copies,
  }));

  return (
    <>
      <header className="weapon-head">
        <div className="weapon-head__art shape">
          <WeaponArt weapon={weapon} size="large" priority />
        </div>
        <div className="weapon-head__text">
          <h1 className="page-title">{weapon.name}</h1>
          <p className="weapon-meta">
            <span>{SLOT_LABEL[weapon.slot]}</span>
            <span>Mastery rank {weapon.masteryReq}</span>
            <span>Added in {weapon.introduced}</span>
            {weapon.isNew && <span className="badge-new">New this month</span>}
          </p>
          <WeaponStatus
            slug={weapon.slug}
            name={weapon.name}
            isIngredient={weapon.usedToBuild.length > 0}
          />
        </div>
      </header>

      <PersonalVerdict
        slug={weapon.slug}
        initialVerdict={verdict}
        initialExplanation={explanation}
        targets={targets}
        names={names}
      />

      {(madeFrom.length > 0 || usedToBuild.length > 0) && (
        <section className="section" aria-labelledby="tree-title">
          <h2 id="tree-title" className="section-title">
            Family tree
          </h2>
          <FamilyTree self={toTree(weapon)} madeFrom={madeFrom} usedToBuild={usedToBuild} />
          <p className="result-count">
            Weapon ingredients only. Resources such as Orokin Cells are part of the recipe but are
            not tracked here.
          </p>
        </section>
      )}
    </>
  );
}
