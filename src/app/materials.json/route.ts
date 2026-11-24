/**
 * What the build planner needs beyond the recipe graph, as a static file: /materials.json. For each
 * weapon, its non-weapon recipe components (blueprint, parts, resources) and its foundry time in
 * seconds. Generated at build time from data/index.json; weapons with neither are left out.
 */

import type { RecipeFileEntry } from '@/data/recipe-file';
import { allWeapons } from '@/data/weapons';

export const dynamic = 'force-static';

export function GET() {
  return Response.json(
    Object.fromEntries(
      allWeapons().flatMap((weapon) => {
        const entry: RecipeFileEntry = {
          ...(weapon.materials?.length ? { materials: weapon.materials } : {}),
          ...(weapon.buildTime ? { buildTime: weapon.buildTime } : {}),
        };
        return Object.keys(entry).length ? [[weapon.slug, entry]] : [];
      })
    )
  );
}
