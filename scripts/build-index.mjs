#!/usr/bin/env node
/**
 * Forgeline: build data/index.json from @wfcd/items.
 *
 * This is section 6 of the spec, implemented against the real field shapes (see
 * docs/spec-review.md section 2 for why the obvious reading of the spec's example record does not
 * work):
 *
 *   - a component is only { uniqueName, itemCount }, so ingredients resolve through a uniqueName map
 *   - 2-copy recipes list the ingredient twice at itemCount 1, so counts must be summed
 *   - `introduced` is an object, `imageName` is not derivable from the display name
 *
 * Output is deterministic: identical input produces a byte-identical file, so the monthly refresh
 * can tell "nothing changed" from "something changed".
 *
 * Usage: node scripts/build-index.mjs [--data <dir>] [--out <file>] [--previous <file>] [--now <iso>]
 *
 *   --out       where to write (default data/index.json)
 *   --previous  the index to compare against for New badges and the unchanged-timestamp rule
 *               (default: the --out file). The monthly refresh builds to data/index.next.json with
 *               --previous data/index.json, so the committed index is only replaced after the gate.
 *   --now       the build time, for reproducible tests (default: now)
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { newSlugs } from './lib/refresh.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SCHEMA = 1;

const WEAPON_FILES = ['Primary', 'Secondary', 'Melee', 'Arch-Gun', 'Arch-Melee', 'SentinelWeapons'];

/** productCategory is the reliable slot source: `category` files sentinel weapons under Primary. */
const SLOT_BY_PRODUCT_CATEGORY = {
  LongGuns: 'primary',
  Pistols: 'secondary',
  Melee: 'melee',
  SpaceGuns: 'arch-gun',
  SpaceMelee: 'arch-melee',
  SentinelWeapons: 'companion',
};

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/**
 * Locate an installed package's root directory. `require.resolve('pkg/package.json')` does not work
 * here: @wfcd/items declares an `exports` map that does not expose its own package.json, so we
 * resolve the entry point and walk up to the nearest package.json instead.
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
  const explicit = arg('data');
  if (explicit) return explicit;
  return path.join(packageRoot('@wfcd/items'), 'data', 'json');
}

function sourceVersion() {
  try {
    const file = path.join(packageRoot('@wfcd/items'), 'package.json');
    return JSON.parse(fs.readFileSync(file, 'utf8')).version;
  } catch {
    return 'unknown';
  }
}

const slugify = (name) =>
  name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const readJson = (file, fallback = null) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;

// ---------------------------------------------------------------- load and filter

const dataDir = resolveDataDir();
const outFile = arg('out', path.join(ROOT, 'data', 'index.json'));
const previousFile = arg('previous', outFile);
const nowIso = arg('now', new Date().toISOString());
const exclusions = readJson(path.join(ROOT, 'data', 'fixtures', 'exclusions.json'), { exclude: [] });
const aliases = readJson(path.join(ROOT, 'data', 'fixtures', 'aliases.json'), {});
const excluded = new Set(exclusions.exclude.map((e) => e.uniqueName));

const raw = [];
for (const file of WEAPON_FILES) {
  for (const weapon of JSON.parse(fs.readFileSync(path.join(dataDir, `${file}.json`), 'utf8'))) {
    raw.push(weapon);
  }
}

/**
 * The six weapon files hold more than player weapons. Dropped here:
 *   - masterable === false            non-obtainable or Conclave duplicates
 *   - type "Zaw Component"            modular parts, filed under Pistols even when melee
 *   - productCategory OperatorAmps    one stray Amp
 *   - anything in data/fixtures/exclusions.json
 */
const isPlayerWeapon = (w) =>
  w.masterable !== false &&
  w.type !== 'Zaw Component' &&
  w.productCategory !== 'OperatorAmps' &&
  !excluded.has(w.uniqueName);

const players = raw.filter(isPlayerWeapon).sort((a, b) => a.name.localeCompare(b.name, 'en'));

// ---------------------------------------------------------------- slugs

const warnings = [];
const slugByUnique = new Map();
const takenSlugs = new Map();
for (const weapon of players) {
  let slug = slugify(weapon.name);
  if (takenSlugs.has(slug)) {
    // Deterministic tiebreak: append the last segment of the uniqueName. Both entries keep a stable
    // URL across rebuilds, and the collision is reported so it can be resolved deliberately.
    const discriminator = slugify(weapon.uniqueName.split('/').pop() ?? '');
    slug = `${slug}-${discriminator}`;
    warnings.push(`slug collision: "${weapon.name}" -> ${slug} (${weapon.uniqueName})`);
  }
  takenSlugs.set(slug, weapon.uniqueName);
  slugByUnique.set(weapon.uniqueName, slug);
}

// ---------------------------------------------------------------- recipe graph

const byUnique = new Map(raw.map((w) => [w.uniqueName, w]));
const usedToBuild = new Map(); // ingredient uniqueName -> Map<target uniqueName, copies>
const madeFrom = new Map(); // target uniqueName -> Map<ingredient uniqueName, copies>

for (const weapon of players) {
  for (const component of weapon.components ?? []) {
    const ingredient = byUnique.get(component.uniqueName);
    if (!ingredient || ingredient.uniqueName === weapon.uniqueName) continue;
    if (!slugByUnique.has(ingredient.uniqueName)) {
      warnings.push(`${weapon.name} needs ${ingredient.name}, which is excluded from the index`);
      continue;
    }
    const copies = component.itemCount ?? 1;
    const forward = usedToBuild.get(ingredient.uniqueName) ?? new Map();
    forward.set(weapon.uniqueName, (forward.get(weapon.uniqueName) ?? 0) + copies);
    usedToBuild.set(ingredient.uniqueName, forward);
    const backward = madeFrom.get(weapon.uniqueName) ?? new Map();
    backward.set(ingredient.uniqueName, (backward.get(ingredient.uniqueName) ?? 0) + copies);
    madeFrom.set(weapon.uniqueName, backward);
  }
}

const edges = (map, unique) =>
  [...(map.get(unique) ?? [])]
    .map(([targetUnique, copies]) => ({ slug: slugByUnique.get(targetUnique), copies }))
    .filter((edge) => edge.slug)
    .sort((a, b) => a.slug.localeCompare(b.slug, 'en'));

// ---------------------------------------------------------------- assemble

const previous = readJson(previousFile);
// New badges: absent from the previous index, or already new earlier this month (scripts/lib).
const fresh = newSlugs(
  previous,
  players.map((weapon) => slugByUnique.get(weapon.uniqueName)),
  nowIso
);

const weapons = players.map((weapon) => {
  const slug = slugByUnique.get(weapon.uniqueName);
  return {
    slug,
    name: weapon.name,
    slot: SLOT_BY_PRODUCT_CATEGORY[weapon.productCategory] ?? 'primary',
    masteryReq: weapon.masteryReq ?? 0,
    // Most weapons cap at rank 30; Kuva, Tenet, Coda and a few others reach 40. Weapons give 100
    // mastery per rank, so this is what the "level it before you sell it" note quotes.
    maxRank: weapon.maxLevelCap ?? 30,
    image: `img/${slug}.webp`,
    thumb: `img/thumb/${slug}.webp`,
    imageSource: weapon.imageName,
    introduced: weapon.introduced?.name ?? 'Unknown',
    introducedDate: weapon.introduced?.date ?? null,
    isNew: fresh.has(slug),
    usedToBuild: edges(usedToBuild, weapon.uniqueName),
    madeFrom: edges(madeFrom, weapon.uniqueName),
    ...(aliases[slug] ? { aliases: aliases[slug] } : {}),
  };
});

// The newest update that introduced a weapon. This is not the same thing as the game's current
// update: the package carries no field for that, so the footer shows this plus the package version
// rather than claiming to know the live game build.
const newestUpdate = players
  .filter((w) => w.introduced?.date)
  .sort((a, b) => b.introduced.date.localeCompare(a.introduced.date))[0];

const index = {
  schema: SCHEMA,
  generatedAt: nowIso,
  sourceVersion: sourceVersion(),
  newestWeaponUpdate: newestUpdate?.introduced?.name ?? 'Unknown',
  newestWeaponDate: newestUpdate?.introduced?.date ?? null,
  counts: {
    weapons: weapons.length,
    ingredients: weapons.filter((w) => w.usedToBuild.length > 0).length,
    craftable: weapons.filter((w) => w.madeFrom.length > 0).length,
  },
  weapons,
};

// ---------------------------------------------------------------- validate

const errors = [];
const bySlug = new Map(weapons.map((w) => [w.slug, w]));
if (bySlug.size !== weapons.length) errors.push('duplicate slugs in the index');
for (const weapon of weapons) {
  if (!weapon.slug) errors.push(`${weapon.name} has no slug`);
  if (!weapon.imageSource) errors.push(`${weapon.name} has no source image`);
  for (const edge of [...weapon.usedToBuild, ...weapon.madeFrom]) {
    if (!bySlug.has(edge.slug)) errors.push(`${weapon.slug} references unknown slug ${edge.slug}`);
    if (!Number.isInteger(edge.copies) || edge.copies < 1) {
      errors.push(`${weapon.slug} -> ${edge.slug} has a bad copy count: ${edge.copies}`);
    }
  }
}
// Both directions must agree, or a tree would render differently depending on where you entered it.
for (const weapon of weapons) {
  for (const edge of weapon.usedToBuild) {
    const target = bySlug.get(edge.slug);
    const mirrored = target?.madeFrom.find((e) => e.slug === weapon.slug);
    if (!mirrored || mirrored.copies !== edge.copies) {
      errors.push(`graph is asymmetric: ${weapon.slug} -> ${edge.slug}`);
    }
  }
}

const isoDate = /^\d{4}-\d{2}-\d{2}/;
for (const weapon of weapons) {
  if (weapon.introducedDate && !isoDate.test(weapon.introducedDate)) {
    errors.push(`${weapon.slug} has a malformed introducedDate: ${weapon.introducedDate}`);
  }
}

// ---------------------------------------------------------------- write

console.log(`source        @wfcd/items ${index.sourceVersion}`);
console.log(`entries       ${raw.length} raw, ${weapons.length} player weapons`);
console.log(`graph         ${index.counts.ingredients} ingredients, ${index.counts.craftable} craftable`);
console.log(`newest weapon ${index.newestWeaponUpdate} (${index.newestWeaponDate ?? 'no date'})`);
if (previous) {
  const added = weapons.filter((w) => w.isNew).map((w) => w.name);
  console.log(`new weapons   ${added.length ? added.join(', ') : 'none this month'}`);
}
for (const warning of warnings) console.log(`warning       ${warning}`);

if (errors.length) {
  console.error(`\n${errors.length} validation error(s), nothing written:`);
  for (const error of errors.slice(0, 25)) console.error(`  ${error}`);
  process.exit(1);
}

// Determinism: `generatedAt` is the only field that moves on its own, so when nothing else changed
// we keep the previous timestamp. That lets the monthly job diff the file and skip a pointless
// redeploy, and keeps "rebuild produces a byte-identical file" true.
const withoutTimestamp = (candidate) => JSON.stringify({ ...candidate, generatedAt: null });
if (previous && withoutTimestamp(previous) === withoutTimestamp(index)) {
  index.generatedAt = previous.generatedAt;
  console.log('unchanged     identical to the committed index, timestamp preserved');
}

// Stable key order and two-space indentation keep the committed diff readable and deterministic.
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(index, null, 2)}\n`);
const bytes = fs.statSync(outFile).size;
console.log(`\nwrote ${path.relative(ROOT, outFile)} (${(bytes / 1024).toFixed(1)} KB raw)`);
