/**
 * What a player should know about a recipe resource at a glance (M6.5, 12.7).
 *
 * @wfcd/items has no rarity for resources: its drop tables rate each drop source, not the
 * resource. The game sorts planet resources into Common, Uncommon and Rare, and this is the Rare
 * set as the Warframe wiki's Resources page lists it (checked November 2026). Nitain Extract and the
 * research materials have no rarity there, so they get no tag. tests/recipe.test.ts checks every
 * name here against the source data, so a renamed resource fails the build rather than silently
 * losing its tag.
 */
export const RARE_RESOURCES: ReadonlySet<string> = new Set([
  'Argon Crystal',
  'Control Module',
  'Gallium',
  'Morphics',
  'Neural Sensors',
  'Neurodes',
  'Orokin Cell',
  'Tellurium',
]);

/**
 * Resources that decay once you hold them. Argon Crystal's own description in @wfcd/items says it
 * "decays every day it is out of the Void"; the test holds this list to that description.
 */
export const DECAYING_RESOURCES: ReadonlySet<string> = new Set(['Argon Crystal']);
