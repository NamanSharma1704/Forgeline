/**
 * The service worker, generated at build time and served as /sw.js (root scope).
 *
 * Spec 5.10: installable and usable offline. M6's acceptance criterion: "the site loads offline
 * after one visit, and a new monthly build prompts a reload rather than silently serving stale
 * data." So:
 *
 *   - Install precaches the core pages, the three data files, the offline page, and the pages of
 *     the 87 recipe weapons (the ones whose verdict needs the engine), plus the scripts and styles
 *     the build emitted. About 1.1 MB over the wire, fetched in the background once per build.
 *   - Pages and data are network first: online, the player always gets the live build; offline,
 *     the last copy. Hashed assets and pictures are cache first.
 *   - Any other weapon page offline falls back to /offline.html, which can still answer: a weapon
 *     that feeds no recipe is Safe to sell, and the recipe data says which those are.
 *   - VERSION changes with every build, so a deploy installs a new worker that waits; the page
 *     offers "Reload" (ServiceWorkerManager) and only then does it take over.
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { allWeapons, weaponIndex } from '@/data/weapons';

export const dynamic = 'force-static';

/**
 * Every script and stylesheet the build emitted. Most are named in the pages' HTML, but the router
 * also loads a few chunks lazily, and those must be saved too or a page offline can stall. The
 * compile step writes them before pages are rendered, so they are on disk when this runs.
 */
function buildChunks(): string[] {
  try {
    return readdirSync(join(process.cwd(), '.next', 'static', 'chunks'), { recursive: true })
      .map((file) => String(file).split('\\').join('/'))
      .filter((file) => /\.(js|css)$/.test(file))
      .map((file) => `/_next/static/chunks/${file}`);
  } catch {
    return [];
  }
}

const VERSION = `${weaponIndex.sourceVersion}-${process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local'}-${new Date().toISOString()}`;

const CORE_PAGES = ['/', '/arsenal/', '/sweep/', '/plan/', '/ingredients/', '/about/'];
const DATA = ['/search-index.json', '/graph.json', '/materials.json', '/offline.html'];
const RECIPE_PAGES = allWeapons()
  .filter((weapon) => weapon.usedToBuild.length > 0 || weapon.madeFrom.length > 0)
  .map((weapon) => `/w/${weapon.slug}/`);

function worker(version: string, pages: string[], data: string[], chunks: string[]) {
  return `/* Forgeline service worker, generated at build time. Version ${version}. */
const VERSION = ${JSON.stringify(version)};
const CACHE = 'forgeline-' + VERSION;
const PAGES = ${JSON.stringify(pages)};
const DATA = ${JSON.stringify(data)};
const CHUNKS = ${JSON.stringify(chunks)};

// Fonts and anything else a page names that is not in CHUNKS.
const ASSET_PATTERN = /\\/_next\\/static\\/[^"'\\s)]+/g;

async function precache() {
  const cache = await caches.open(CACHE);
  const assets = new Set(CHUNKS);
  await Promise.allSettled(
    [...PAGES, ...DATA].map(async (url) => {
      const response = await fetch(url, { cache: 'no-cache' });
      // A redirected response cannot answer a navigation, so only store direct hits.
      if (!response.ok || response.redirected) return;
      if (PAGES.includes(url)) {
        const html = await response.clone().text();
        for (const asset of html.match(ASSET_PATTERN) ?? []) assets.add(asset);
      }
      await cache.put(url, response);
    })
  );
  await Promise.allSettled(
    [...assets].map(async (url) => {
      if (await cache.match(url)) return;
      const response = await fetch(url);
      if (response.ok) await cache.put(url, response);
    })
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('forgeline-') && key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
  return response;
}

async function networkFirst(request, fallback) {
  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected) (await caches.open(CACHE)).put(request, response.clone());
    return response;
  } catch (error) {
    const navigate = request.mode === 'navigate';
    const cached = await caches.match(request, { ignoreSearch: navigate, ignoreVary: navigate });
    if (cached) return cached;
    if (fallback) return fallback();
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/img/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, async () => (await caches.match('/offline.html')) ?? Response.error())
    );
    return;
  }

  // Data files and the router's page payloads. A payload that fails offline returns a network
  // error, which makes the router fall back to a full page load, which the cache can answer.
  event.respondWith(networkFirst(request));
});
`;
}

export function GET() {
  return new Response(worker(VERSION, [...CORE_PAGES, ...RECIPE_PAGES], DATA, buildChunks()), {
    headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
  });
}
