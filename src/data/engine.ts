/**
 * The recipe graph for build-time rendering. Built once per build from the committed index; every
 * statically rendered page shares it.
 */

import { createGraph } from '@/engine';
import { graphWeapons } from './weapons';

export const recipeGraph = createGraph(graphWeapons());
