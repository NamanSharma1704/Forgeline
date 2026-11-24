/**
 * The service worker, generated at build time and served as /sw.js (root scope).
 *
 * Spec 5.10: installable and usable offline. M6's acceptance criterion: "the site loads offline
 * after one visit, and a new monthly build prompts a reload rather than silently serving stale
 * data." So:
 *
 *   - Install precaches the core pages, the three data files, the offline page, and the pages of
 *     the 87 recipe weapons (the ones whose verdict needs the engine), plus the scripts, styles
 *     and fonts those pages name. About 1.1 MB over the wire, fetched in the background once per
 *     build.
 *   - Pages and data are network first: online, the player always gets the live build; offline,
 *     the last copy. Hashed assets and pictures are cache first.
 *   - Any other weapon page offline falls back to /offline/, which can still answer: a weapon
 *     that feeds no recipe is Safe to sell, and the recipe data says which those are.
 *   - VERSION changes with every build, so a deploy installs a new worker that waits; the page
 *     offers "Reload" (ServiceWorkerManager) and only then does it take over.
 */

import { allWeapons, weaponIndex } from '@/data/weapons';

export const dynamic = 'force-static';

const VERSION = `${weaponIndex.sourceVersion}-${process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local'}-${new Date().toISOString()}`;

const CORE_PAGES = ['/', '/arsenal/', '/sweep/', '/plan/', '/ingredients/', '/about/'];
const DATA = ['/search-index.json', '/graph.json', '/materials.json'];
const RECIPE_PAGES = allWeapons()
  .filter((weapon) => weapon.usedToBuild.length > 0 || weapon.madeFrom.length > 0)
  .map((weapon) => `/w/${weapon.slug}/`);

function worker(version: string, pages: string[], data: string[]) {
  return `/* Forgeline service worker, generated at build time. Version ${version}. */
const VERSION = ${JSON.stringify(version)};
const CACHE = 'forgeline-' + VERSION;
const PAGES = ${JSON.stringify(pages)};
const DATA = ${JSON.stringify(data)};

// public/offline/index.html. Hosts differ on whether a folder's index answers at the folder
// (Vercel strips .html), so try both and keep whichever works under one key.
const OFFLINE = '/offline/';
const OFFLINE_SOURCES = ['/offline/', '/offline/index.html'];

// Every script, stylesheet and font a page loads is named in its HTML, including the router
// payload inlined there. Read from the pages rather than the build folder, because hosts lay that
// out differently (Vercel serves it under /_next/static/immutable/). The backslash is excluded
// because the inlined payload is escaped JSON.
const ASSET_PATTERN = /\\/_next\\/static\\/[^"'\\s)\\\\]+/g;

async function precache() {
  const cache = await caches.open(CACHE);
  const assets = new Set();
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
  for (const url of OFFLINE_SOURCES) {
    const response = await fetch(url, { cache: 'no-cache' }).catch(() => null);
    if (response && response.ok && !response.redirected) {
      await cache.put(OFFLINE, response);
      break;
    }
  }
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
      networkFirst(request, async () => (await caches.match(OFFLINE)) ?? Response.error())
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
  return new Response(worker(VERSION, [...CORE_PAGES, ...RECIPE_PAGES], DATA), {
    headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
  });
}
