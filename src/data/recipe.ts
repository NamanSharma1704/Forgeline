/**
 * One weapon's whole recipe as the pages show it: weapon ingredients with their names, everything
 * else it takes, and what the build costs in credits and Foundry time. Plain data, so a server page
 * can hand it to a client component.
 */

import type { Material } from './types';

export interface RecipeSummary {
  readonly slug: string;
  readonly name: string;
  readonly weapons: readonly { readonly slug: string; readonly name: string; readonly copies: number }[];
  readonly materials: readonly Material[];
  /** Credits per build. */
  readonly buildPrice?: number;
  /** Credits for the blueprint in the Market, when it is sold there. */
  readonly blueprintPrice?: number;
  /** Seconds in the Foundry per build. */
  readonly buildTime?: number;
}
