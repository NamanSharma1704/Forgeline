import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FamilyTree, type TreeColumn, type TreeEdge, type TreeWeapon } from '@/components/FamilyTree';
import { Icon } from '@/components/Icon';
import { Pedestal, slotTone } from '@/components/Pedestal';
import { PersonalVerdict } from '@/components/PersonalVerdict';
import { RecipeList } from '@/components/RecipeList';
import type { CardTarget } from '@/components/VerdictCard';
import { WeaponStatus } from '@/components/WeaponStatus';
import { recipeGraph } from '@/data/engine';
import { SLOT_LABEL, type Weapon } from '@/data/types';
import { variantOf } from '@/data/variants';
import {
  allWeapons,
  communityLinksOf,
  getWeapon,
  incarnonGenesisOf,
  recipeOf,
  resolve,
  versionCallouts,
  versionsOf,
} from '@/data/weapons';
import { createEvaluator, explain, familyTree, type TreeNode } from '@/engine';
import { shortTime } from '@/format/time';

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

const toTree = (weapon: Weapon): TreeWeapon => ({ ...toCard(weapon), mr: weapon.masteryReq });

/** The id of the weapon's own box in the tree, which every first-generation wire meets. */
const SELF = 'self';

/**
 * Flatten one direction of the engine's tree into generation columns, and the wires between them.
 * A weapon reached along two branches (a diamond) appears once per column, with both captions
 * joined and a wire to each parent. Wires always run the way materials flow: ingredient to product.
 */
function generations(
  roots: readonly TreeNode[],
  side: 'before' | 'after',
  caption: (node: TreeNode, parent: string | null) => string,
  labels: (generation: number) => string
): { columns: TreeColumn[]; edges: TreeEdge[] } {
  const columns: TreeColumn[] = [];
  const edges = new Map<string, TreeEdge>();
  type Step = { node: TreeNode; parentId: string; parentName: string | null };
  let frontier: Step[] = roots.map((node) => ({ node, parentId: SELF, parentName: null }));
  for (let generation = 1; frontier.length > 0; generation++) {
    const idOf = (slug: string) => `${side}-${generation}-${slug}`;
    const merged = new Map<string, { id: string; weapon: TreeWeapon; captions: string[] }>();
    for (const { node, parentId, parentName } of frontier) {
      const id = idOf(node.slug);
      const entry = merged.get(node.slug) ?? { id, weapon: toTree(resolve(node.slug)), captions: [] };
      entry.captions.push(caption(node, parentName));
      merged.set(node.slug, entry);
      const edge: TreeEdge =
        side === 'before'
          ? { from: id, to: parentId, copies: node.copies, far: 'from' }
          : { from: parentId, to: id, copies: node.copies, far: 'to' };
      edges.set(`${edge.from}>${edge.to}`, edge);
    }
    columns.push({
      label: labels(generation),
      boxes: [...merged.values()].map(({ id, weapon, captions }) => ({
        id,
        weapon,
        caption: [...new Set(captions)].join(', '),
      })),
    });
    frontier = frontier.flatMap(({ node }) =>
      node.children.map((child) => ({
        node: child,
        parentId: idOf(node.slug),
        parentName: resolve(node.slug).name,
      }))
    );
  }
  return { columns, edges: [...edges.values()] };
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

const recipes = (n: number) => (n === 0 ? 'None' : n === 1 ? '1 recipe' : `${n} recipes`);

/**
 * The weapon dossier (design plan 4): identity on the left, the verdict on the right, the family
 * tree and recipe across the full width below. On narrower screens it is one column, and the
 * verdict follows straight after the name and picture, so a phone reaches the answer first.
 */
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
  const chainSlugs = descendants(slug);
  const names = Object.fromEntries(chainSlugs.map((s) => [s, resolve(s).name]));
  const ranks = Object.fromEntries(chainSlugs.map((s) => [s, resolve(s).masteryReq]));
  const variant = variantOf(weapon.name);
  const versions = versionsOf(slug);
  const callouts = versionCallouts(slug);
  const outside = communityLinksOf(slug);
  const incarnon = incarnonGenesisOf(weapon);
  const tone = slotTone(weapon.slot);

  // The full depth, at most three steps each way in the current data.
  const tree = familyTree(recipeGraph, slug);
  const before = generations(
    tree.madeFrom,
    'before',
    (node, parent) => (parent ? `${node.copies} for ${parent}` : `${node.copies} needed`),
    (generation) => (generation === 1 ? 'Made from' : 'Before that')
  );
  const after = generations(
    tree.usedToBuild,
    'after',
    (node, parent) => (parent ? `uses ${node.copies} ${parent}` : `uses ${node.copies}`),
    (generation) => (generation === 1 ? 'Used to build' : 'Then')
  );
  const recipe = recipeOf(weapon);
  const hasRecipe = recipe.weapons.length > 0 || recipe.materials.length > 0;

  return (
    <>
      <div className="dossier">
        <header className="dossier__id">
          <Pedestal weapon={weapon} />
          <div className="dossier__identity">
            <p className="dossier__eyebrow">
              <span className="slot-tag" data-slot={tone}>
                {SLOT_LABEL[weapon.slot]}
              </span>
              {/* The ribbon says it when there is one; a weapon with no other version still gets the label. */}
              {variant.line && versions.length < 2 && <span className="dossier__variant">{variant.line}</span>}
              {weapon.isNew && <span className="badge-new">New this month</span>}
            </p>
            <h1 className="page-title dossier__name">{weapon.name}</h1>
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
          </div>
          <dl className="telemetry-matrix">
            <div className="telemetry-matrix__cell">
              <dt>Mastery rank</dt>
              <dd className="telemetry-matrix__mr">MR {weapon.masteryReq}</dd>
            </div>
            <div className="telemetry-matrix__cell">
              <dt>Added in</dt>
              <dd>{weapon.introduced}</dd>
            </div>
            <div className="telemetry-matrix__cell">
              <dt>Foundry</dt>
              <dd>{recipe.buildTime ? shortTime(recipe.buildTime) : 'No recipe'}</dd>
            </div>
            <div className="telemetry-matrix__cell">
              <dt>Ingredient for</dt>
              <dd>{recipes(weapon.usedToBuild.length)}</dd>
            </div>
          </dl>
        </header>

        <div className="dossier__verdict">
          <PersonalVerdict
            slug={weapon.slug}
            initialVerdict={verdict}
            initialExplanation={explanation}
            targets={targets}
            names={names}
            ranks={ranks}
            plan={hasRecipe ? { href: `/plan/?w=${weapon.slug}`, label: `Plan a build of ${weapon.name}` } : undefined}
          />
        </div>

        {(incarnon || callouts.length > 0) && (
          <div className="dossier__notes">
            {incarnon && (
              <p className="incarnon-strip">
                <Icon name="incarnon" size={20} className="incarnon-strip__icon" />
                <span>
                  <span className="incarnon-strip__label">Incarnon Genesis</span>
                  <span className="incarnon-strip__text">Can take the {incarnon}.</span>
                </span>
              </p>
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
          </div>
        )}

        <section className="dossier__own" aria-label={`Your ${weapon.name}`}>
          <WeaponStatus slug={weapon.slug} name={weapon.name} isIngredient={weapon.usedToBuild.length > 0} />
          {(outside.wiki || outside.market) && (
            <p className="weapon-links">
              {outside.wiki && (
                <a
                  href={outside.wiki}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Drop locations, stats and notes, on the community wiki"
                >
                  <Icon name="external" size={14} />
                  Warframe Wiki
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
              {outside.market && (
                <a
                  href={outside.market}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="What players are trading it for, on warframe.market"
                >
                  <Icon name="external" size={14} />
                  warframe.market
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
            </p>
          )}
        </section>
      </div>

      {(before.columns.length > 0 || after.columns.length > 0) && (
        <section className="section schematic" aria-labelledby="tree-title">
          <p className="eyebrow schematic__eyebrow">
            {/* One run of text, so it wraps as a line on a phone rather than as columns. */}
            <span>
              Foundry schematic{' '}
              <span className="eyebrow__sep" aria-hidden="true">
                {'//'}
              </span>{' '}
              what it comes from and what it goes into
            </span>
          </p>
          <h2 id="tree-title" className="section-title">
            Family tree
          </h2>
          <FamilyTree
            self={toTree(weapon)}
            before={before.columns.reverse()}
            after={after.columns}
            edges={[...before.edges, ...after.edges]}
          />
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
