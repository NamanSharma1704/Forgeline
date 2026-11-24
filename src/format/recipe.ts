/** A recipe's costs as the pages say them. Plain text, usable from server and client code. */

import type { RecipeSummary } from '../data/recipe';
import { shortTime } from './time';

const count = (n: number) => n.toLocaleString('en-GB');

/** "20,000 credits to build", "12 h in the Foundry", "blueprint 15,000 credits in the Market". */
export function recipeCosts(recipe: RecipeSummary): string[] {
  return [
    recipe.buildPrice ? `${count(recipe.buildPrice)} credits to build` : null,
    recipe.buildTime ? `${shortTime(recipe.buildTime)} in the Foundry` : null,
    recipe.blueprintPrice ? `blueprint ${count(recipe.blueprintPrice)} credits in the Market` : null,
  ].filter((part): part is string => part !== null);
}
