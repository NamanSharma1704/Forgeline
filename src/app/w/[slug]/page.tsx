import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FamilyTree, type TreeColumn, type TreeEdge } from '@/components/FamilyTree';
import { Icon } from '@/components/Icon';
import type { TileWeapon } from '@/components/parts/ArsenalTile';
import { CodexFrame } from '@/components/parts/CodexFrame';
import { Ledger, type LedgerRow } from '@/components/parts/Ledger';
import { RecipeSlots } from '@/components/parts/RecipeSlots';
import { RecordVisit } from '@/components/parts/recent';
import { PersonalVerdict } from '@/components/PersonalVerdict';
import { WeaponStatus } from '@/components/WeaponStatus';
import { recipeGraph } from '@/data/engine';
import type { RecipeSummary } from '@/data/recipe';
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

const toTile = (weapon: Weapon): TileWeapon => ({
  slug: weapon.slug,
  name: weapon.name,
  slot: weapon.slot,
  image: weapon.image,
  thumb: weapon.thumb,
  mr: weapon.masteryReq,
});

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
    const merged = new Map<string, { id: string; weapon: TileWeapon; captions: string[] }>();
    for (const { node, parentId, parentName } of frontier) {
      const id = idOf(node.slug);
      const entry = merged.get(node.slug) ?? { id, weapon: toTile(resolve(node.slug)), captions: [] };
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

/** Every weapon reachable forward from this one, so any personal chain can be drawn. */
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
 * The weapon dossier (design plan 6), its Codex and Arsenal inspection. The Codex frame, name and
 * versions, then the verdict, then the ledger, field notes and the player's own status; the family
 * tree and the recipe in Foundry slots run the full width below. Two columns from 1024 px (the
 * verdict on the right); below that one column, with the verdict straight after the frame and
 * name, so a phone reaches the answer first.
 */
export default async function WeaponPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const weapon = getWeapon(slug);
  if (!weapon) notFound();

  const self = toTile(weapon);
  const verdict = evaluator.verdict(slug);
  const explanation = explain(verdict, recipeGraph);
  const targets = verdict.targets.map((target) => {
    const built = resolve(target.slug);
    return { ...toTile(built), recipe: recipeOf(built) };
  });
  const recipe = recipeOf(weapon);
  const hasRecipe = recipe.weapons.length > 0 || recipe.materials.length > 0;

  // Tiles for every weapon the screen can draw: the chains ahead, and the weapons in each recipe shown.
  const inRecipes = (summary: RecipeSummary) => summary.weapons.map((ingredient) => ingredient.slug);
  const tileSlugs = new Set([
    ...descendants(slug),
    ...inRecipes(recipe),
    ...targets.flatMap((target) => inRecipes(target.recipe)),
  ]);
  const tiles = Object.fromEntries([...tileSlugs].map((s) => [s, toTile(resolve(s))]));

  const variant = variantOf(weapon.name);
  const versions = versionsOf(slug);
  const callouts = versionCallouts(slug);
  const outside = communityLinksOf(slug);
  const incarnon = incarnonGenesisOf(weapon);

  const facts: LedgerRow[] = [
    { label: 'Slot', value: SLOT_LABEL[weapon.slot] },
    { label: 'Mastery rank', value: `MR ${weapon.masteryReq}`, tone: 'gold' },
    { label: 'Foundry', value: recipe.buildTime ? shortTime(recipe.buildTime) : 'No recipe' },
    { label: 'Added in', value: weapon.introduced },
    { label: 'Ingredient for', value: recipes(weapon.usedToBuild.length) },
    // The version tabs say it when there are some; a lone Kuva or Prisma weapon still gets it.
    ...(variant.line && versions.length < 2 ? [{ label: 'Variant', value: variant.line }] : []),
  ];

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

  return (
    <>
      <RecordVisit weapon={self} />
      <div className="dossier">
        <header className="dossier__id">
          <CodexFrame weapon={self} priority />
          <div className="dossier__identity">
            <h1 className="dossier__name">{weapon.name}</h1>
            {weapon.isNew && <p className="dossier__new">New this month</p>}
            {versions.length > 1 && (
              <nav className="variant-tabs" aria-label={`Versions of ${variant.base}`}>
                {versions.map((version) => {
                  const line = variantOf(version.name).line ?? 'Normal';
                  return version.slug === weapon.slug ? (
                    <span key={version.slug} className="variant-tab" aria-current="page" title={version.name}>
                      {line}
                    </span>
                  ) : (
                    <Link key={version.slug} href={`/w/${version.slug}/`} className="variant-tab" title={version.name}>
                      {line}
                      <span className="sr-only">: {version.name}</span>
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>
        </header>

        <div className="dossier__verdict">
          <PersonalVerdict
            slug={weapon.slug}
            initialVerdict={verdict}
            initialExplanation={explanation}
            targets={targets}
            tiles={tiles}
            plan={hasRecipe ? { href: `/plan/?w=${weapon.slug}`, label: `Plan a build of ${weapon.name}` } : undefined}
          />
        </div>

        <Ledger className="dossier__facts" rows={facts} />

        {(incarnon || callouts.length > 0) && (
          <div className="dossier__notes">
            {incarnon && (
              <p className="field-note">
                <span className="field-note__label">
                  <Icon name="incarnon" size={16} />
                  Incarnon Genesis
                </span>
                <span>Can take the {incarnon}.</span>
              </p>
            )}
            {callouts.map((callout) => (
              <p key={callout} className="field-note field-note--steel">
                <span className="field-note__label">
                  <Icon name="info" size={16} />
                  Versions
                </span>
                <span>{callout}</span>
              </p>
            ))}
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
          <h2 id="tree-title" className="section-title">
            Family tree
          </h2>
          <FamilyTree
            self={self}
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
          <RecipeSlots recipe={recipe} art={tiles} />
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
