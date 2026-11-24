/**
 * Checks and records the outside links on weapon pages (M6.5, 12.8): the weapon's page on the
 * Warframe wiki and its item page on warframe.market. Both sites are asked once, here, and the
 * answer is committed as data/links.json, so neither the site build nor the monthly data refresh
 * depends on either site being up, and no page links to an address that was not there.
 *
 *   wiki    @wfcd/items gives each weapon a wiki address, but a few are stale ("Corvas Prime
 *           (Atmosphere)" is now "Corvas Prime"). Each candidate title (that address, then the
 *           weapon's own name) is checked through the wiki's API, redirects followed, and the
 *           first that exists is kept. No title, no link.
 *   market  warframe.market's item list carries each item's game id (gameRef), the same id
 *           @wfcd/items calls uniqueName, so weapons are matched exactly, never by guessing a
 *           name. A weapon the market does not list (Lato Prime, a Founders item, or anything
 *           untradable) gets no link.
 *
 * Run after a refresh adds weapons: npm run data:links. New weapons simply have no links until
 * then. Requests identify only as a generic link checker and send nothing about the player.
 *
 * Usage: node scripts/fetch-links.mjs [--out <file>]
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEAPON_FILES = ['Primary', 'Secondary', 'Melee', 'Arch-Gun', 'Arch-Melee', 'SentinelWeapons'];
const WIKI_API = 'https://wiki.warframe.com/api.php';
const MARKET_ITEMS = 'https://api.warframe.market/v2/items';
const HEADERS = { 'User-Agent': 'data-link-check/1.0', Accept: 'application/json' };
const BATCH = 50;

const argIndex = process.argv.indexOf('--out');
const outFile = argIndex > 0 ? process.argv[argIndex + 1] : path.join(ROOT, 'data', 'links.json');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function packageRoot(name) {
  const require = createRequire(path.join(ROOT, 'package.json'));
  let dir = path.dirname(require.resolve(name));
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error(`cannot locate the ${name} package`);
}

async function getJson(url) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, { headers: HEADERS });
    if (response.ok) return response.json();
    if (attempt === 3) throw new Error(`${response.status} from ${url.slice(0, 120)}`);
    await sleep(1500 * attempt);
  }
}

// ---------------------------------------------------------------- the weapons to link

const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'index.json'), 'utf8'));
const dataDir = path.join(packageRoot('@wfcd/items'), 'data', 'json');
const sourceByName = new Map();
for (const file of WEAPON_FILES) {
  for (const item of JSON.parse(fs.readFileSync(path.join(dataDir, `${file}.json`), 'utf8'))) {
    if (!sourceByName.has(item.name)) sourceByName.set(item.name, item);
  }
}
const weapons = index.weapons.map((weapon) => ({ slug: weapon.slug, name: weapon.name, source: sourceByName.get(weapon.name) }));
const unmatched = weapons.filter((w) => !w.source).map((w) => w.name);
if (unmatched.length) console.warn(`not in the source by name, so no links: ${unmatched.join(', ')}`);

// ---------------------------------------------------------------- warframe.market

const marketItems = (await getJson(MARKET_ITEMS)).data ?? [];
const marketByRef = new Map(marketItems.filter((item) => item.gameRef && item.slug).map((item) => [item.gameRef, item.slug]));
const market = {};
for (const weapon of weapons) {
  const slug = weapon.source && marketByRef.get(weapon.source.uniqueName);
  if (slug && /^[a-z0-9_]+$/.test(slug)) market[weapon.slug] = slug;
}

// ---------------------------------------------------------------- the wiki

const titleFromUrl = (url) => {
  try {
    const parsed = new URL(url);
    if (!/(^|\.)wiki\.warframe\.com$|(^|\.)warframe\.fandom\.com$/.test(parsed.hostname)) return null;
    const last = parsed.pathname.split('/').pop();
    return last ? decodeURIComponent(last).replace(/_/g, ' ') : null;
  } catch {
    return null;
  }
};

const candidates = new Map(
  weapons.map((w) => [w.slug, [...new Set([titleFromUrl(w.source?.wikiaUrl ?? ''), w.name].filter(Boolean))]])
);
const allTitles = [...new Set([...candidates.values()].flat())];
const resolved = new Map(); // asked title -> final title, or null when missing

for (let i = 0; i < allTitles.length; i += BATCH) {
  const batch = allTitles.slice(i, i + BATCH);
  const url = `${WIKI_API}?action=query&format=json&redirects=1&titles=${batch.map(encodeURIComponent).join('%7C')}`;
  const { query = {} } = await getJson(url);
  const normalized = new Map((query.normalized ?? []).map((n) => [n.from, n.to]));
  const redirects = new Map((query.redirects ?? []).map((r) => [r.from, r.to]));
  const existing = new Set(
    Object.values(query.pages ?? {})
      .filter((page) => page.ns === 0 && !('missing' in page) && !('invalid' in page))
      .map((page) => page.title)
  );
  for (const asked of batch) {
    const normal = normalized.get(asked) ?? asked;
    const final = redirects.get(normal) ?? normal;
    resolved.set(asked, existing.has(final) ? final : null);
  }
  await sleep(300);
}

const wiki = {};
const noWiki = [];
for (const weapon of weapons) {
  const title = (candidates.get(weapon.slug) ?? []).map((t) => resolved.get(t)).find(Boolean);
  if (title) wiki[weapon.slug] = title;
  else noWiki.push(weapon.name);
}

// ---------------------------------------------------------------- write

const sorted = (record) => Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b, 'en')));
const previous = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : null;

// The monthly refresh runs this unattended. A site that answers but has changed its API, or is
// half down, must not wipe the links it already has: a sharp drop leaves the file alone.
for (const [label, next, before] of [
  ['wiki', wiki, previous?.wiki],
  ['market', market, previous?.market],
]) {
  const had = Object.keys(before ?? {}).length;
  const has = Object.keys(next).length;
  if (had > 0 && has < had * 0.9) {
    throw new Error(`${label}: ${has} links where there were ${had}; leaving data/links.json as it is`);
  }
}

const unchanged =
  previous &&
  JSON.stringify(previous.wiki) === JSON.stringify(sorted(wiki)) &&
  JSON.stringify(previous.market) === JSON.stringify(sorted(market));
fs.writeFileSync(
  outFile,
  `${JSON.stringify(
    {
      // Only moves when a link does, so a month with no new weapons leaves no diff behind.
      checkedAt: unchanged ? previous.checkedAt : new Date().toISOString(),
      wiki: sorted(wiki),
      market: sorted(market),
    },
    null,
    2
  )}\n`
);

console.log(`wiki pages    ${Object.keys(wiki).length} of ${weapons.length}`);
if (noWiki.length) console.log(`  none for    ${noWiki.join(', ')}`);
console.log(`market items  ${Object.keys(market).length} of ${weapons.length}`);
console.log(`wrote ${path.relative(ROOT, outFile)}`);
