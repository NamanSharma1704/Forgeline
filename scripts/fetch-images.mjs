#!/usr/bin/env node
/**
 * Forgeline: download weapon art and convert it to the two WebP sizes the site serves.
 *
 * Driven by data/index.json and data/images.manifest.json, so a normal month fetches only what
 * changed. The manifest records the sha256 of each source file, which is the only reliable change
 * signal: the upstream filenames are stable and carry no version.
 *
 * Measured on the current data: sources are 512x512 PNG with alpha averaging 34 KB, output is about
 * 12 KB at 256 px and 3 KB at 96 px, so the full set is roughly 9 MB from a 21 MB download.
 *
 * Notes that cost time to rediscover:
 *   - cdn.warframestat.us/img/<name> 301-redirects to raw.githubusercontent.com, so redirects must
 *     be followed and the real dependency is GitHub raw.
 *   - `imageName` is not derivable from the weapon name (Dual Skana is DualSkanas.png).
 *   - Several weapons share one source image, so downloads dedupe by source and outputs are keyed
 *     by weapon slug.
 *   - A failed fetch never deletes what is already on disk. Stale art beats a broken page.
 *
 * Usage: node scripts/fetch-images.mjs [--force] [--recheck] [--report <file>] [--limit <n>]
 *        [--concurrency <n>]
 *
 *   --recheck  download every source again and compare hashes, converting only what changed. The
 *              monthly refresh uses this: upstream can replace art under the same filename, and a
 *              hash is the only way to notice. About 21 MB per run.
 *   --report   write {checked, converted, failures} as JSON, for the run summary
 *   --force    reconvert everything, changed or not
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const sharp = require('sharp');

const CDN = 'https://cdn.warframestat.us/img/';
const LARGE = { dir: path.join(ROOT, 'public', 'img'), size: 256, quality: 82 };
const THUMB = { dir: path.join(ROOT, 'public', 'img', 'thumb'), size: 96, quality: 78 };
const MANIFEST = path.join(ROOT, 'data', 'images.manifest.json');
const INDEX = path.join(ROOT, 'data', 'index.json');
const RETRIES = 3;

const flag = (name) => process.argv.includes(`--${name}`);
const option = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? Number(process.argv[i + 1]) : fallback;
};

const force = flag('force');
const recheck = flag('recheck');
const concurrency = option('concurrency', 8);
const limit = option('limit', Infinity);
const reportIndex = process.argv.indexOf('--report');
const reportFile = reportIndex !== -1 ? process.argv[reportIndex + 1] : null;

const writeReport = (report) => {
  if (reportFile) fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
};

const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
const manifest = fs.existsSync(MANIFEST)
  ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  : { schema: 1, generatedAt: null, sources: {} };

fs.mkdirSync(LARGE.dir, { recursive: true });
fs.mkdirSync(THUMB.dir, { recursive: true });

/** source imageName -> every slug that uses it */
const bySource = new Map();
for (const weapon of index.weapons) {
  if (!weapon.imageSource) continue;
  bySource.set(weapon.imageSource, [...(bySource.get(weapon.imageSource) ?? []), weapon.slug]);
}

const outputsExist = (slugs) =>
  slugs.every(
    (slug) =>
      fs.existsSync(path.join(LARGE.dir, `${slug}.webp`)) &&
      fs.existsSync(path.join(THUMB.dir, `${slug}.webp`))
  );

const work = [...bySource.entries()]
  .filter(
    ([source, slugs]) => force || recheck || !manifest.sources[source] || !outputsExist(slugs)
  )
  .slice(0, limit === Infinity ? undefined : limit);

console.log(`${bySource.size} source images for ${index.weapons.length} weapons`);
console.log(`${work.length} to fetch, ${bySource.size - work.length} already current`);
if (work.length === 0) {
  console.log('nothing to do');
  writeReport({ checked: 0, converted: [], failures: [] });
  process.exit(0);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function download(source) {
  let lastError;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const response = await fetch(CDN + encodeURIComponent(source), { redirect: 'follow' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < RETRIES) await sleep(400 * 2 ** attempt);
    }
  }
  throw lastError;
}

async function convert(buffer, slugs) {
  for (const tier of [LARGE, THUMB]) {
    const webp = await sharp(buffer)
      .resize(tier.size, tier.size, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: tier.quality, effort: 5 })
      .toBuffer();
    for (const slug of slugs) await fsp.writeFile(path.join(tier.dir, `${slug}.webp`), webp);
  }
}

const failures = [];
const converted = [];
const manifestBefore = JSON.stringify(manifest.sources);
let done = 0;
let fetched = 0;
let unchanged = 0;
let bytesIn = 0;

const queue = [...work];
async function worker() {
  for (;;) {
    const job = queue.shift();
    if (!job) return;
    const [source, slugs] = job;
    try {
      const buffer = await download(source);
      bytesIn += buffer.length;
      const sha = crypto.createHash('sha256').update(buffer).digest('hex');
      const known = manifest.sources[source];
      if (!force && known?.sha256 === sha && outputsExist(slugs)) {
        unchanged++;
      } else {
        await convert(buffer, slugs);
        fetched++;
        converted.push(source);
      }
      manifest.sources[source] = { sha256: sha, bytes: buffer.length, slugs: [...slugs].sort() };
    } catch (error) {
      failures.push(`${source}: ${error.message}`);
    }
    done++;
    if (done % 50 === 0 || done === work.length) {
      process.stdout.write(`  ${done}/${work.length} processed\r`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
process.stdout.write('\n');

manifest.schema = 1;
manifest.sources = Object.fromEntries(
  Object.entries(manifest.sources).sort(([a], [b]) => a.localeCompare(b, 'en'))
);
// Only touch the timestamp when an image actually changed, so a recheck that finds nothing new
// leaves the file byte-identical and the monthly refresh has nothing to commit.
const sourcesChanged =
  JSON.stringify(manifest.sources) !==
  JSON.stringify(
    Object.fromEntries(
      Object.entries(JSON.parse(manifestBefore)).sort(([a], [b]) => a.localeCompare(b, 'en'))
    )
  );
if (sourcesChanged || converted.length > 0 || !manifest.generatedAt) {
  manifest.generatedAt = new Date().toISOString();
}
fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
writeReport({ checked: work.length, converted: [...converted].sort(), failures });

const du = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .reduce((total, entry) => total + fs.statSync(path.join(dir, entry.name)).size, 0);

console.log(`converted     ${fetched}`);
console.log(`unchanged     ${unchanged}`);
console.log(`downloaded    ${(bytesIn / 1024 / 1024).toFixed(1)} MB`);
console.log(`on disk       ${((du(LARGE.dir) + du(THUMB.dir)) / 1024 / 1024).toFixed(1)} MB`);

// A weapon with no art at all is a real gap: the page falls back to a silhouette, but we want to
// know about it. Existing files are never deleted, so a failed refetch is not fatal.
const missing = index.weapons.filter(
  (weapon) => !fs.existsSync(path.join(LARGE.dir, `${weapon.slug}.webp`))
);
if (failures.length) {
  console.log(`\n${failures.length} fetch failure(s):`);
  for (const failure of failures.slice(0, 20)) console.log(`  ${failure}`);
}
if (missing.length) {
  console.log(`\n${missing.length} weapon(s) with no image on disk:`);
  for (const weapon of missing.slice(0, 20)) console.log(`  ${weapon.slug}`);
  process.exit(1);
}
console.log('\nevery weapon has both image tiers');
