/**
 * The search index, as a static file. Generated at build time from data/index.json, so it can
 * never drift from the weapon pages, and served as /search-index.json.
 *
 * Static export renders a GET route handler to a file when it is marked force-static
 * (node_modules/next/dist/docs/01-app/02-guides/static-exports.md, "Route Handlers").
 */

import { allWeapons } from '@/data/weapons';
import { toSearchEntries } from '@/search/rank';

export const dynamic = 'force-static';

export function GET() {
  return Response.json(toSearchEntries(allWeapons()));
}
