import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FamilyTree, type TreeColumn, type TreeWeapon } from '@/components/FamilyTree';
import { Icon } from '@/components/Icon';
import { PersonalVerdict } from '@/components/PersonalVerdict';
import { RecipeList } from '@/components/RecipeList';
import type { CardTarget } from '@/components/VerdictCard';
import { WeaponArt } from '@/components/WeaponArt';
import { WeaponStatus } from '@/components/WeaponStatus';
import { recipeGraph } from '@/data/engine';
import { SLOT_LABEL, type Weapon } from '@/data/types';
import { variantOf } from '@/data/variants';
import {
  allWeapons,
  getWeapon,
  incarnonGenesisOf,
  recipeOf,
  resolve,
  versionCallouts,
  versionsOf,
} from '@/data/weapons';
import { createEvaluator, explain, familyTree, type TreeNode } from '@/engine';

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

const toTree = (weapon: Weapon): TreeWeapon => toCard(weapon);

/**
 * Flatten one direction of the engine's tree into generation columns. A weapon reached along two
 * branches (a diamond) appears once per column, with both captions joined.
 */
function generations(
  roots: readonly TreeNode[],
  caption: (node: TreeNode, parent: string | null) => string,
  labels: (generation: number) => string
): TreeColumn[] {
  const columns: TreeColumn[] = [];
  let frontier: { node: TreeNode; parent: string | null }[] = roots.map((node) => ({ node, parent: null }));
  for (let generation = 1; frontier.length > 0; generation++) {
    const merged = new Map<string, { weapon: TreeWeapon; captions: string[] }>();
    for (const { node, parent } of frontier) {
      const entry = merged.get(node.slug) ?? { weapon: toTree(resolve(node.slug)), captions: [] };
      entry.captions.push(caption(node, parent));
      merged.set(node.slug, entry);
    }
    columns.push({
      label: labels(generation),
      boxes: [...merged.values()].map(({ weapon, captions }) => ({
        weapon,
        caption: [...new Set(captions)].join(', '),
      })),
    });
    frontier = frontier.flatMap(({ node }) =>
      node.children.map((child) => ({ node: child, parent: resolve(node.slug).name }))
    );
  }
  return columns;
}

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
  const targets = verdict.targets.map((target) => {
    const built = resolve(target.slug);
    return { ...toCard(built), recipe: recipeOf(built) };
  });
  const names = Object.fromEntries(descendants(slug).map((s) => [s, resolve(s).name]));
  const variant = variantOf(weapon.name);
  const versions = versionsOf(slug);
  const callouts = versionCallouts(slug);
  const incarnon = incarnonGenesisOf(weapon);

  // Phase 2: the full depth, at most three steps each way in the current data.
  const tree = familyTree(recipeGraph, slug);
  const before = generations(
    tree.madeFrom,
    (node, parent) => (parent ? `${node.copies} for ${parent}` : `${node.copies} needed`),
    (generation) => (generation === 1 ? 'Made from' : 'Before that')
  ).reverse();
  const after = generations(
    tree.usedToBuild,
    (node, parent) => (parent ? `uses ${node.copies} ${parent}` : `uses ${node.copies}`),
    (generation) => (generation === 1 ? 'Used to build' : 'Then')
  );
  const recipe = recipeOf(weapon);
  const hasRecipe = recipe.weapons.length > 0 || recipe.materials.length > 0;

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
            {/* The ribbon says it when there is one; a weapon with no other version still gets the label. */}
            {variant.line && versions.length < 2 && <span>{variant.line} variant</span>}
            {incarnon && (
              <span className="badge-incarnon" title={`Can take the ${incarnon}`}>
                <Icon name="incarnon" size={16} />
                Incarnon Genesis
              </span>
            )}
            {weapon.isNew && <span className="badge-new">New this month</span>}
          </p>
          {versions.length > 1 && (
            <nav className="versions" aria-label={`Versions of ${variant.base}`}>
              <span className="versions__label">Versions</span>
              <ul className="chips">
                {versions.map((version) => {
                  const line = variantOf(version.name).line ?? 'Normal';
                  return (
                    <li key={version.slug}>
                      {version.slug === weapon.slug ? (
                        <span className="chip chip--link" aria-current="page" title={version.name}>
                          {line}
                        </span>
                      ) : (
                        <Link href={`/w/${version.slug}/`} className="chip chip--link" title={version.name}>
                          {line}
                          <span className="sr-only">: {version.name}</span>
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
          {callouts.length > 0 && (
            <ul className="version-callouts">
              {callouts.map((callout) => (
                <li key={callout}>
                  <Icon name="info" size={18} />
                  <span>{callout}</span>
                </li>
              ))}
            </ul>
          )}
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

      {(before.length > 0 || after.length > 0) && (
        <section className="section" aria-labelledby="tree-title">
          <h2 id="tree-title" className="section-title">
            Family tree
          </h2>
          <FamilyTree self={toTree(weapon)} before={before} after={after} />
        </section>
      )}

      {hasRecipe && (
        <section className="section" aria-labelledby="recipe-title">
          <h2 id="recipe-title" className="section-title">
            Recipe
          </h2>
          <RecipeList recipe={recipe} />
          <p className="verdict__footnote">
            {weapon.madeFrom.length > 0 ? (
              <>
                Weapons count towards verdicts; the rest is listed, not tracked.{' '}
                <Link href={`/plan/?w=${weapon.slug}`}>Plan a build of {weapon.name}</Link>, down the
                whole chain.
              </>
            ) : (
              'Listed for reference, not tracked.'
            )}
          </p>
        </section>
      )}
    </>
  );
}
