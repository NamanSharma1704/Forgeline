/**
 * The build planner (spec 5.6) against the real graph, and the materials now in the index.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { WeaponIndex } from '../src/data/types';
import { createGraph, foundryTime, planBuild, totalResources, type Arsenal } from '../src/engine';

const ROOT = path.resolve(import.meta.dirname, '..');
const index = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'index.json'), 'utf8')
) as WeaponIndex;
const graph = createGraph(index.weapons);
const materialsOf = (slug: string) => index.weapons.find((w) => w.slug === slug)?.materials;

const summary = (arsenal: Arsenal, target: string) => {
  const plan = planBuild(graph, arsenal, target);
  return {
    lines: plan.lines.map((l) => [l.slug, l.needed, l.have, l.toMake, l.depth]),
    steps: plan.steps.map((l) => `${l.craftable ? 'build' : 'get'} ${l.toMake} ${l.slug}`),
  };
};

describe('build planner', () => {
  it('plans Akjagara from nothing, down the whole chain', () => {
    expect(summary({}, 'akjagara')).toEqual({
      lines: [
        ['akjagara', 1, 0, 1, 0],
        ['akbolto', 1, 0, 1, 1],
        ['dual-skana', 1, 0, 1, 1],
        ['bolto', 2, 0, 2, 2],
        ['lato', 2, 0, 2, 3],
      ],
      // Deepest first: the order to work through it.
      steps: ['get 2 lato', 'build 2 bolto', 'build 1 akbolto', 'get 1 dual-skana', 'build 1 akjagara'],
    });
  });

  it('counts copies already held, which shrinks everything below them', () => {
    const plan = summary({ bolto: { status: 'mastered', qty: 1 } }, 'akjagara');
    expect(plan.lines).toContainEqual(['bolto', 2, 1, 1, 2]);
    expect(plan.lines).toContainEqual(['lato', 1, 0, 1, 3]);
  });

  it('drops the branch below a weapon the player already holds', () => {
    const plan = summary({ akbolto: { status: 'owned' } }, 'akjagara');
    expect(plan.lines).toContainEqual(['akbolto', 1, 1, 0, 1]);
    expect(plan.lines.map((l) => l[0])).not.toContain('bolto');
    expect(plan.lines.map((l) => l[0])).not.toContain('lato');
    expect(plan.steps).toEqual(['get 1 dual-skana', 'build 1 akjagara']);
  });

  it('ignores sold copies, which are gone', () => {
    expect(summary({ akbolto: { status: 'sold' } }, 'akjagara').lines).toContainEqual(['akbolto', 1, 0, 1, 1]);
  });

  it('always plans one new copy of the target, even if one is held', () => {
    expect(summary({ akjagara: { status: 'mastered' } }, 'akjagara').lines[0]).toEqual(['akjagara', 1, 0, 1, 0]);
  });

  it('records what each weapon is used for in the plan', () => {
    const plan = planBuild(graph, {}, 'redeemer');
    expect(plan.lines.find((l) => l.slug === 'dual-skana')?.usedFor).toEqual([{ slug: 'redeemer', copies: 1 }]);
  });

  it('plans a weapon with no weapon ingredients as a single step', () => {
    expect(summary({}, 'braton')).toEqual({ lines: [['braton', 1, 0, 1, 0]], steps: ['get 1 braton'] });
  });

  it('totals shared resources and leaves blueprints and parts out', () => {
    const totals = totalResources(planBuild(graph, {}, 'akbolto'), materialsOf);
    // Akbolto: Orokin Cell x1. Two Boltos: 2 x (Neurodes 2, Orokin Cell 2, Polymer Bundle 800).
    expect(totals).toContainEqual({ name: 'Polymer Bundle', count: 1600 });
    expect(totals).toContainEqual({ name: 'Neurodes', count: 4 });
    expect(totals.find((t) => t.name === 'Orokin Cell')?.count).toBeGreaterThanOrEqual(5);
    expect(totals.map((t) => t.name)).not.toContain('Blueprint');
  });
});

describe('materials in the index', () => {
  it('lists the non-weapon parts of a recipe with their kind', () => {
    expect(materialsOf('bolto')).toEqual([
      { name: 'Blueprint', kind: 'blueprint', count: 1 },
      { name: 'Neurodes', kind: 'resource', count: 2 },
      { name: 'Orokin Cell', kind: 'resource', count: 2 },
      { name: 'Polymer Bundle', kind: 'resource', count: 800 },
    ]);
  });

  it('never lists a weapon as a material', () => {
    const slugsByName = new Set(index.weapons.map((w) => w.name));
    for (const weapon of index.weapons) {
      for (const material of weapon.materials ?? []) {
        expect(slugsByName.has(material.name) && material.kind !== 'part', `${weapon.slug}: ${material.name}`).toBe(false);
        expect(material.count, `${weapon.slug}: ${material.name}`).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe('foundry time (M6.5, 12.6)', () => {
  const HOUR = 3600;
  const timeOf = (slug: string) => index.weapons.find((w) => w.slug === slug)?.buildTime;
  const stagesOf = (t: ReturnType<typeof foundryTime>) =>
    t.stages.map((s) => [s.number, s.steps.map((step) => step.slug)]);

  it('counts only the slowest chain when builds run at once, and every copy one at a time', () => {
    // A is built from B and C; B from D. C is slow, so it decides when A can start.
    const g = createGraph([
      { slug: 'a', name: 'A', usedToBuild: [], madeFrom: [{ slug: 'b', copies: 1 }, { slug: 'c', copies: 1 }] },
      { slug: 'b', name: 'B', usedToBuild: [{ slug: 'a', copies: 1 }], madeFrom: [{ slug: 'd', copies: 2 }] },
      { slug: 'c', name: 'C', usedToBuild: [{ slug: 'a', copies: 1 }], madeFrom: [] },
      { slug: 'd', name: 'D', usedToBuild: [{ slug: 'b', copies: 2 }], madeFrom: [] },
    ]);
    const hours = { a: 1, b: 5, c: 10, d: 2 } as Record<string, number>;
    const t = foundryTime(g, planBuild(g, {}, 'a'), (slug) => hours[slug]! * HOUR);
    expect(stagesOf(t)).toEqual([
      [1, ['c', 'd']],
      [2, ['b']],
      [3, ['a']],
    ]);
    expect(t.fastest).toBe(11 * HOUR); // A after the slower of B+D (7) and C (10)
    expect(t.oneAtATime).toBe((1 + 5 + 10 + 2 * 2) * HOUR); // both copies of D
  });

  it('plans Akjagara from nothing: four stages, two days at best', () => {
    const t = foundryTime(graph, planBuild(graph, {}, 'akjagara'), timeOf);
    expect(stagesOf(t)).toEqual([
      [1, ['dual-skana', 'lato']],
      [2, ['bolto']],
      [3, ['akbolto']],
      [4, ['akjagara']],
    ]);
    expect(t.fastest).toBe(48 * HOUR);
    expect(t.oneAtATime).toBe(84 * HOUR); // 7 builds of 12 hours
    expect(t.unknown).toEqual([]);
  });

  it('starts from what the player holds: two Bolto in hand leave two stages', () => {
    const t = foundryTime(graph, planBuild(graph, { bolto: { status: 'owned', qty: 2 } }, 'akjagara'), timeOf);
    expect(stagesOf(t)).toEqual([
      [1, ['akbolto', 'dual-skana']],
      [2, ['akjagara']],
    ]);
    expect(t.fastest).toBe(24 * HOUR);
  });

  it('names a step whose time the data does not have, and counts it as none', () => {
    const t = foundryTime(graph, planBuild(graph, {}, 'aklex'), timeOf);
    expect(t.unknown).toEqual(['lex']);
    expect(t.fastest).toBe(12 * HOUR);
  });
});
