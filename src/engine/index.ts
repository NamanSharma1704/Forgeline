/**
 * Forgeline's verdict engine. Pure functions over a recipe graph and a player's arsenal.
 * The rules are specified in docs/verdict-rules.md; tests/engine.test.ts holds every fixture.
 *
 *   const graph = createGraph(index.weapons);
 *   const evaluator = createEvaluator(graph, arsenal);
 *   const verdict = evaluator.verdict('bolto');
 *   const text = explain(verdict, graph);
 */

export { createGraph, type GraphInput } from './graph';
export { createDemand, type Demand } from './demand';
export { createEvaluator, computeVerdict, type Evaluator } from './verdict';
export { explain, listOf, type Explanation, type Tone } from './explain';
export { familyTree, type FamilyTree, type TreeNode, type TreeOptions } from './tree';
export {
  heldCount,
  holds,
  isArsenalSetUp,
  isRecorded,
  masteryDone,
  masteryFor,
  statusOf,
} from './status';
export type * from './types';
