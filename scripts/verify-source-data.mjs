#!/usr/bin/env node
/**
 * Forgeline: read-only audit of the upstream weapon data.
 *
 * Reproduces the index build described in section 6 of the spec and reports everything the
 * implementation has to cope with: the derived ingredient graph, chain depths, entries that are not
 * player weapons, duplicate names, slug collisions, image coverage and the index size.
 *
 * It mutates nothing. It is both the evidence behind docs/spec-review.md and the seed of
 * scripts/build-index.mjs and the monthly publish gate.
 *
 * Usage:
 *   npm i @wfcd/items
 *   node scripts/verify-source-data.mjs
 *   node scripts/verify-source-data.mjs --data <path to @wfcd/items/data/json>
 *
 * Exits 1 if the derived ingredient graph disagrees with data/fixtures/verified-recipes.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

/** The six files that hold player weapons. Section 6, step 1. */
const WEAPON_FILES = ['Primary', 'Secondary', 'Melee', 'Arch-Gun', 'Arch-Melee', 'SentinelWeapons'];

/** productCategory is the reliable slot source. `category` files sentinel weapons under Primary. */
const SLOT_BY_PRODUCT_CATEGORY = {
  LongGuns: 'primary',
  Pistols: 'secondary',
  Melee: 'melee',
  SpaceGuns: 'arch-gun',
  SpaceMelee: 'arch-melee',
  SentinelWeapons: 'companion',
};

/**
 * `require.resolve('@wfcd/items/package.json')` fails: the package's `exports` map does not expose
 * its own package.json. Resolve the entry point and walk up to the nearest package.json instead.
 */
function packageRoot(name) {
  const require = createRequire(path.join(ROOT, 'package.json'));
  let dir = path.dirname(require.resolve(name));
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error(`cannot locate the ${name} package`);
}

function resolveDataDir() {
  const flag = process.argv.indexOf('--data');
  if (flag !== -1 && process.argv[flag + 1]) return process.argv[flag + 1];
  try {
    return path.join(packageRoot('@wfcd/items'), 'data', 'json');
  } catch {
    console.error('Could not resolve @wfcd/items. Run `npm i @wfcd/items` or pass --data <dir>.');
    process.exit(2);
  }
}

const slugify = (name) =>
  name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** A player weapon, as opposed to a modular part or a non-masterable entry. */
const isPlayerWeapon = (w) =>
  w.masterable !== false && w.type !== 'Zaw Component' && w.productCategory !== 'OperatorAmps';

function load(dataDir) {
  const all = [];
  for (const file of WEAPON_FILES) {
    const full = path.join(dataDir, `${file}.json`);
    for (const w of JSON.parse(fs.readFileSync(full, 'utf8'))) all.push({ ...w, sourceFile: file });
  }
  return all;
}

/**
 * Section 6, steps 2 to 4. Components carry only { uniqueName, itemCount }, so ingredients are
 * resolved through a uniqueName index, and counts are summed because 2-copy recipes list the
 * ingredient twice.
 */
function buildGraph(weapons) {
  const byUnique = new Map(weapons.map((w) => [w.uniqueName, w]));
  const usedToBuild = new Map();
  const madeFrom = new Map();
  for (const weapon of weapons) {
    for (const component of weapon.components ?? []) {
      const ingredient = byUnique.get(component.uniqueName);
      if (!ingredient || ingredient.uniqueName === weapon.uniqueName) continue;
      const copies = component.itemCount ?? 1;
      const forward = usedToBuild.get(ingredient.name) ?? new Map();
      forward.set(weapon.name, (forward.get(weapon.name) ?? 0) + copies);
      usedToBuild.set(ingredient.name, forward);
      const backward = madeFrom.get(weapon.name) ?? new Map();
      backward.set(ingredient.name, (backward.get(ingredient.name) ?? 0) + copies);
      madeFrom.set(weapon.name, backward);
    }
  }
  return { usedToBuild, madeFrom };
}

function forwardDepth(name, usedToBuild, seen = new Set()) {
  if (seen.has(name)) return 0;
  seen.add(name);
  const children = usedToBuild.get(name);
  if (!children) return 0;
  return 1 + Math.max(...[...children.keys()].map((c) => forwardDepth(c, usedToBuild, new Set(seen))));
}

function report(title) {
  console.log(`\n=== ${title} ===`);
}

const dataDir = resolveDataDir();
const raw = load(dataDir);
const players = raw.filter(isPlayerWeapon);
const { usedToBuild, madeFrom } = buildGraph(raw);
const ingredients = [...usedToBuild.keys()].sort();

report('Source');
console.log('data directory      ', dataDir);
console.log('weapon entries      ', raw.length);
console.log('player weapons      ', players.length, `(dropped ${raw.length - players.length})`);
console.log('with a recipe       ', raw.filter((w) => w.components?.length).length);
console.log('missing imageName   ', raw.filter((w) => !w.imageName).length);

report('Slots (productCategory)');
const slots = {};
for (const w of players) {
  const slot = SLOT_BY_PRODUCT_CATEGORY[w.productCategory] ?? `UNMAPPED:${w.productCategory}`;
  slots[slot] = (slots[slot] ?? 0) + 1;
}
console.log(slots);

report('Ingredient graph');
console.log('ingredient weapons  ', ingredients.length);
console.log('build targets       ', madeFrom.size);
const depths = ingredients.map((n) => [n, forwardDepth(n, usedToBuild)]);
const byDepth = depths.reduce((acc, [, d]) => ({ ...acc, [d]: (acc[d] ?? 0) + 1 }), {});
console.log('forward chain depth ', byDepth, 'deepest:', depths.sort((a, b) => b[1] - a[1])[0]);
const both = ingredients.filter((n) => madeFrom.has(n));
console.log('ingredient and target', both.join(', '));

report('Closure check: is any weapon consumed outside the six weapon files?');
const weaponUnique = new Map(raw.map((w) => [w.uniqueName, w.name]));
let scanned = 0;
const outside = [];
const walk = (node, file, rootName) => {
  for (const component of node.components ?? []) {
    scanned++;
    if (weaponUnique.has(component.uniqueName) && component.uniqueName !== node.uniqueName) {
      if (!WEAPON_FILES.includes(file.replace('.json', ''))) {
        outside.push(`${file}: ${rootName} <- ${weaponUnique.get(component.uniqueName)}`);
      }
    }
    walk(component, file, rootName);
  }
};
for (const file of fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'))) {
  let items;
  try {
    items = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
  } catch {
    continue;
  }
  if (!Array.isArray(items)) continue;
  for (const item of items) walk(item, file, item.name);
}
console.log(`scanned ${scanned} component references, ${outside.length} outside the weapon files`);
if (outside.length) console.log(outside.slice(0, 20).join('\n'));

report('Entries needing care');
const nonMasterable = raw.filter((w) => w.masterable === false);
console.log('masterable === false', nonMasterable.length, `(${nonMasterable.slice(0, 5).map((w) => w.name).join(', ')}, ...)`);
const names = new Map();
for (const w of players) names.set(w.name, [...(names.get(w.name) ?? []), w]);
const duplicateNames = [...names].filter(([, list]) => list.length > 1);
console.log('duplicate names among player weapons:', duplicateNames.length);
for (const [name, list] of duplicateNames) {
  console.log(`  ${name}: ${list.map((w) => w.uniqueName).join(' | ')}`);
}
const slugs = new Map();
for (const w of players) slugs.set(slugify(w.name), [...(slugs.get(slugify(w.name)) ?? []), w.name]);
console.log('slug collisions:', [...slugs].filter(([, v]) => v.length > 1).length);

report('Images');
const sources = new Set(players.map((w) => w.imageName));
console.log('distinct imageName  ', sources.size, 'for', players.length, 'weapons');
console.log('name-derived?       ', 'no. Dual Skana ->', raw.find((w) => w.name === 'Dual Skana')?.imageName);
console.log('estimated output    ', `${((players.length * (12 + 3)) / 1024).toFixed(1)} MB of WebP (256 px + 96 px)`);

report('Index size');
const index = players.map((w) => ({
  slug: slugify(w.name),
  name: w.name,
  slot: SLOT_BY_PRODUCT_CATEGORY[w.productCategory],
  masteryReq: w.masteryReq,
  introduced: w.introduced?.name,
  introducedDate: w.introduced?.date,
  usedToBuild: [...(usedToBuild.get(w.name) ?? [])].map(([name, copies]) => ({ slug: slugify(name), copies })),
  madeFrom: [...(madeFrom.get(w.name) ?? [])].map(([name, copies]) => ({ slug: slugify(name), copies })),
}));
console.log('minimal index bytes ', JSON.stringify(index).length, '(roughly a quarter of that gzipped)');

report('Fixture comparison');
const fixturePath = path.join(ROOT, 'data', 'fixtures', 'verified-recipes.json');
if (!fs.existsSync(fixturePath)) {
  console.log('no fixture at data/fixtures/verified-recipes.json, skipping');
  process.exit(0);
}
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const problems = [];
const expected = new Map(fixture.ingredients.map((row) => [row.name, row]));
for (const [name, row] of expected) {
  const derived = usedToBuild.get(name);
  if (!derived) {
    problems.push(`MISSING: ${name} is no longer an ingredient`);
    continue;
  }
  for (const target of row.usedToBuild) {
    const copies = derived.get(target.name);
    if (copies === undefined) problems.push(`MISSING: ${name} -> ${target.name}`);
    else if (copies !== target.copies) {
      problems.push(`COUNT: ${name} -> ${target.name} expected ${target.copies}, derived ${copies}`);
    }
  }
  for (const target of derived.keys()) {
    if (!row.usedToBuild.some((t) => t.name === target)) problems.push(`NEW: ${name} -> ${target}`);
  }
}
for (const name of ingredients) {
  if (!expected.has(name)) problems.push(`NEW INGREDIENT: ${name}`);
}
console.log(`fixture rows ${fixture.ingredients.length}, derived ${ingredients.length}, problems ${problems.length}`);
if (problems.length) {
  console.log(problems.join('\n'));
  console.log('\nA change here is not automatically wrong, but it must be reviewed against the wiki');
  console.log('and the fixture updated deliberately before the site publishes it.');
  process.exit(1);
}
console.log('derived graph matches the fixture exactly');
