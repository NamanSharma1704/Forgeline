/**
 * The shape of /materials.json, shared by the route that writes it and the planner that reads it.
 */

import type { Material } from './types';

export interface RecipeFileEntry {
  readonly materials?: readonly Material[];
  /** Foundry time for one build, in seconds. */
  readonly buildTime?: number;
}

export type RecipeFile = Readonly<Record<string, RecipeFileEntry>>;
