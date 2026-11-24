/**
 * Each weapon's non-weapon recipe components (blueprint, parts, resources), as a static file for the
 * build planner: /materials.json. Generated at build time from data/index.json.
 */

import { allWeapons } from '@/data/weapons';

export const dynamic = 'force-static';

export function GET() {
  return Response.json(
    Object.fromEntries(
      allWeapons()
        .filter((weapon) => weapon.materials?.length)
        .map((weapon) => [weapon.slug, weapon.materials])
    )
  );
}
