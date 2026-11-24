/**
 * Forgeline: the decisions behind the monthly refresh, as pure functions.
 *
 * Kept free of I/O so tests can drive every branch. The scripts (build-index, diff-index) and the
 * workflow (.github/workflows/refresh-data.yml) only read files, call these, and act on the result.
 *
 * The rule the whole module serves: the refresh must be unable to publish bad data. A half-broken
 * upstream format that drops recipes would turn Keep into Safe to sell, which is worse than serving
 * last month's data. So:
 *
 *   - anything that changes the recipe graph is blocked until a person checks it against the wiki
 *     and re-runs the refresh with "accept recipe changes" (which also updates the fixture);
 *   - changes that look like a broken source rather than a game update (a large swing in the
 *     ingredient count, many weapons vanishing) are blocked outright, accepted or not;
 *   - everything else (new weapons outside the graph, art, metadata, New badges) publishes.
 */

/** Thresholds for "this looks broken, not updated". Real updates move these by a handful. */
export const DEFAULT_LIMITS = Object.freeze({
  /** Share of ingredient weapons gained or lost in one refresh. */
  maxIngredientSwing: 0.2,
  /** Share of all weapons that may disappear in one refresh. */
  maxRemovedShare: 0.05,
});

export const monthOf = (iso) => String(iso).slice(0, 7);

/**
 * Which weapons carry the New badge (spec 5.9: "weapons added since the previous monthly refresh
 * get a New badge until the next one").
 *
 * New means absent from the previous index. A second refresh in the same calendar month (a manual
 * run after a mid-month game update) keeps the month's existing badges instead of clearing them,
 * because the previous index then already contains those weapons. The first build of all marks
 * nothing as new.
 */
export function newSlugs(previous, nextSlugs, nowIso) {
  const result = new Set();
  if (!previous || !Array.isArray(previous.weapons) || previous.weapons.length === 0) return result;
  const before = new Set(previous.weapons.map((w) => w.slug));
  const sameMonth = Boolean(previous.generatedAt) && monthOf(previous.generatedAt) === monthOf(nowIso);
  const carried = new Set(
    sameMonth ? previous.weapons.filter((w) => w.isNew).map((w) => w.slug) : []
  );
  for (const slug of nextSlugs) {
    if (!before.has(slug) || carried.has(slug)) result.add(slug);
  }
  return result;
}

const pick = (w) => ({ slug: w.slug, name: w.name });

function diffEdges(before, after) {
  const was = new Map(before.map((e) => [e.slug, e.copies]));
  const now = new Map(after.map((e) => [e.slug, e.copies]));
  const added = [...now].filter(([slug]) => !was.has(slug)).map(([slug, copies]) => ({ slug, copies }));
  const removed = [...was].filter(([slug]) => !now.has(slug)).map(([slug, copies]) => ({ slug, copies }));
  const changed = [...now]
    .filter(([slug, copies]) => was.has(slug) && was.get(slug) !== copies)
    .map(([slug, copies]) => ({ slug, from: was.get(slug), to: copies }));
  return added.length || removed.length || changed.length ? { added, removed, changed } : null;
}

/** Fields that change what a page shows but not what a verdict says. */
const DISPLAY_FIELDS = ['name', 'slot', 'masteryReq', 'maxRank', 'introduced', 'introducedDate', 'isNew', 'aliases', 'materials', 'buildTime', 'buildPrice', 'blueprintPrice', 'incarnonGenesis', 'obtain'];

const ingredientSlugs = (index) =>
  new Set(index.weapons.filter((w) => w.usedToBuild.length > 0).map((w) => w.slug));

/**
 * Everything that differs between two indexes, ignoring `generatedAt` and `sourceVersion`: a new
 * package version with identical data is not a change worth deploying.
 */
export function diffIndexes(old, next) {
  const before = new Map(old.weapons.map((w) => [w.slug, w]));
  const after = new Map(next.weapons.map((w) => [w.slug, w]));

  const added = next.weapons.filter((w) => !before.has(w.slug)).map(pick);
  const removed = old.weapons.filter((w) => !after.has(w.slug)).map(pick);

  const recipeChanges = [];
  const imageChanges = [];
  const displayChanges = [];
  for (const weapon of next.weapons) {
    const was = before.get(weapon.slug);
    if (!was) continue;
    const edges = diffEdges(was.usedToBuild, weapon.usedToBuild);
    if (edges) recipeChanges.push({ ...pick(weapon), ...edges });
    if (was.imageSource !== weapon.imageSource) {
      imageChanges.push({ ...pick(weapon), from: was.imageSource, to: weapon.imageSource });
    }
    const fields = DISPLAY_FIELDS.filter(
      (field) => JSON.stringify(was[field]) !== JSON.stringify(weapon[field])
    );
    if (fields.length) displayChanges.push({ ...pick(weapon), fields });
  }

  const oldIngredients = ingredientSlugs(old);
  const nextIngredients = ingredientSlugs(next);
  const nameOf = (slug) => after.get(slug)?.name ?? before.get(slug)?.name ?? slug;
  const ingredientsAdded = [...nextIngredients]
    .filter((slug) => !oldIngredients.has(slug))
    .map((slug) => ({ slug, name: nameOf(slug) }));
  const ingredientsRemoved = [...oldIngredients]
    .filter((slug) => !nextIngredients.has(slug))
    .map((slug) => ({ slug, name: nameOf(slug) }));

  return {
    fromVersion: old.sourceVersion,
    toVersion: next.sourceVersion,
    counts: {
      old: { weapons: old.weapons.length, ingredients: oldIngredients.size },
      next: { weapons: next.weapons.length, ingredients: nextIngredients.size },
    },
    added,
    removed,
    recipeChanges,
    ingredientsAdded,
    ingredientsRemoved,
    imageChanges,
    displayChanges,
    changed:
      added.length + removed.length + recipeChanges.length + imageChanges.length + displayChanges.length >
      0,
  };
}

const pct = (share) => `${Math.round(share * 100)}%`;
const names = (items, max = 8) =>
  items.length <= max
    ? items.map((i) => i.name).join(', ')
    : `${items.slice(0, max).map((i) => i.name).join(', ')} and ${items.length - max} more`;

/**
 * The publish decision.
 *
 *   unchanged  nothing worth deploying; the repository stays exactly as it is
 *   publish    safe to promote, test, commit and deploy
 *   blocked    a person must look first; `hard` reasons cannot be accepted away
 */
export function decide(report, { accept = false, limits = DEFAULT_LIMITS } = {}) {
  if (!report.changed) return { status: 'unchanged', reasons: [], accepted: [] };

  const hard = [];
  const review = [];
  const { old, next } = report.counts;

  const swing = Math.abs(next.ingredients - old.ingredients) / Math.max(1, old.ingredients);
  if (swing > limits.maxIngredientSwing) {
    hard.push(
      `Ingredient weapons went from ${old.ingredients} to ${next.ingredients}, a ${pct(swing)} swing. ` +
        `A game update moves this by a handful; a swing this size usually means the source format changed.`
    );
  }
  const removedShare = report.removed.length / Math.max(1, old.weapons);
  if (removedShare > limits.maxRemovedShare) {
    hard.push(
      `${report.removed.length} of ${old.weapons} weapons disappeared (${pct(removedShare)}), including ${names(report.removed)}. ` +
        `Weapons are almost never removed from the game; this looks like a broken source.`
    );
  }

  const lost = report.ingredientsRemoved;
  if (lost.length === 1) {
    review.push(
      `${lost[0].name} stopped being an ingredient. ` +
        `If that is wrong, the site would start calling it safe to sell.`
    );
  } else if (lost.length > 1) {
    review.push(
      `${lost.length} weapons stopped being ingredients: ${names(lost)}. ` +
        `If that is wrong, the site would start calling them safe to sell.`
    );
  }
  const gained = report.ingredientsAdded;
  if (gained.length === 1) {
    review.push(`${gained[0].name} became an ingredient.`);
  } else if (gained.length > 1) {
    review.push(`${gained.length} weapons became ingredients: ${names(gained)}.`);
  }
  const otherRecipes = report.recipeChanges.filter(
    (change) =>
      !report.ingredientsAdded.some((i) => i.slug === change.slug) &&
      !report.ingredientsRemoved.some((i) => i.slug === change.slug)
  );
  if (otherRecipes.length) {
    review.push(`Recipes changed for ${names(otherRecipes)}.`);
  }

  if (hard.length) return { status: 'blocked', reasons: [...hard, ...review], accepted: [] };
  if (review.length && !accept) return { status: 'blocked', reasons: review, accepted: [] };
  return { status: 'publish', reasons: [], accepted: accept ? review : [] };
}

const edgeText = (edge) => `${edge.slug} x${edge.copies}`;

/** A Markdown report for the run summary and, when blocked, the GitHub issue. */
export function renderReport(report, decision, { runUrl } = {}) {
  const lines = [];
  const title = {
    unchanged: 'Nothing changed this month',
    publish: 'Refresh ready to publish',
    blocked: 'Refresh blocked: needs a person',
  }[decision.status];
  lines.push(`## ${title}`, '');
  lines.push(
    `Data package \`@wfcd/items\` ${report.fromVersion} to ${report.toVersion}. ` +
      `Weapons ${report.counts.old.weapons} to ${report.counts.next.weapons}, ` +
      `ingredient weapons ${report.counts.old.ingredients} to ${report.counts.next.ingredients}.`,
    ''
  );
  if (runUrl) lines.push(`Run: ${runUrl}`, '');

  if (decision.status === 'blocked') {
    lines.push('### Why it stopped', '', ...decision.reasons.map((r) => `- ${r}`), '');
    lines.push(
      '### What to do',
      '',
      '1. Check each recipe change below against the WARFRAME Wiki.',
      '2. If they are right, run the **Monthly data refresh** workflow by hand with **accept recipe changes** ticked. That publishes the data and updates `data/fixtures/verified-recipes.json` to match.',
      '3. If they are wrong, leave it: the live site keeps last month\'s data. Report the source problem upstream at https://github.com/wfcd/warframe-items/issues.',
      ''
    );
  }
  if (decision.accepted.length) {
    lines.push('### Accepted after review', '', ...decision.accepted.map((r) => `- ${r}`), '');
  }

  const section = (heading, items, render) => {
    if (!items.length) return;
    lines.push(`### ${heading} (${items.length})`, '', ...items.slice(0, 50).map((i) => `- ${render(i)}`));
    if (items.length > 50) lines.push(`- and ${items.length - 50} more`);
    lines.push('');
  };
  section('New weapons', report.added, (w) => w.name);
  section('Removed weapons', report.removed, (w) => w.name);
  section('Recipe changes', report.recipeChanges, (c) => {
    const parts = [];
    if (c.added.length) parts.push(`now builds ${c.added.map(edgeText).join(', ')}`);
    if (c.removed.length) parts.push(`no longer builds ${c.removed.map(edgeText).join(', ')}`);
    if (c.changed.length) {
      parts.push(c.changed.map((x) => `${x.slug} needs ${x.to} instead of ${x.from}`).join(', '));
    }
    return `${c.name}: ${parts.join('; ')}`;
  });
  section('Picture changes', report.imageChanges, (c) => `${c.name}: ${c.from} to ${c.to}`);
  section('Other page changes', report.displayChanges, (c) => `${c.name}: ${c.fields.join(', ')}`);

  return lines.join('\n');
}

/** The entry recorded in data/changelog.json for a published refresh. */
export function changelogEntry(report, nowIso) {
  return {
    date: nowIso,
    fromVersion: report.fromVersion,
    toVersion: report.toVersion,
    added: report.added,
    removed: report.removed,
    recipeChanges: report.recipeChanges.map((c) => ({ slug: c.slug, name: c.name })),
    imageChanges: report.imageChanges.map((c) => ({ slug: c.slug, name: c.name })),
  };
}
