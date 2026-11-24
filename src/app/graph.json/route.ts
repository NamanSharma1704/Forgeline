/**
 * The recipe graph as a static file, /graph.json, for running the verdict engine in the browser.
 * Rendered at build time from data/index.json (static export: force-static GET route handler).
 */

import { toGraphFile } from '@/data/graph-file';
import { graphWeapons } from '@/data/weapons';

export const dynamic = 'force-static';

export function GET() {
  return Response.json(toGraphFile(graphWeapons()));
}
