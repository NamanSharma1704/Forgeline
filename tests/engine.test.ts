/**
 * The verdict engine against the real recipe graph.
 *
 * Fixtures 1 to 14 are the table in docs/verdict-rules.md section 6. Property tests below them run
 * the rules over all 46 ingredient weapons, including a seeded random walk that checks the one
 * guarantee that matters most: recording more progress can never make a verdict stricter.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { WeaponIndex } from '../src/data/types';
import {
  createDemand,
  createEvaluator,
  createGraph,
  computeVerdict,
  explain,
  familyTree,
  type Arsenal,
  type ArsenalEntry,
  type KeepVerdict,
  type OwnershipStatus,
  type SafeVerdict,
  type TargetLine,
  type Verdict,
} from '../src/engine';

const ROOT = path.resolve(import.meta.dirname, '..');
const index = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'index.json'), 'utf8')
) as WeaponIndex;
const graph = createGraph(index.weapons);

/**
 * Braton builds nothing and is built from nothing, so marking it mastered sets the arsenal up (rule
 * 2) without touching any recipe the fixtures look at.
 */
const MARKER: Arsenal = { braton: { status: 'mastered' } };
const setUp = (entries: Record<string, ArsenalEntry> = {}): Arsenal => ({ ...MARKER, ...entries });
const s = (status: OwnershipStatus, qty?: number): ArsenalEntry =>
  qty === undefined ? { status } : { status, qty };

const verdict = (slug: string, arsenal: Arsenal) => computeVerdict(graph, arsenal, slug);

function asKeep(v: Verdict): KeepVerdict {
  expect(v.kind, JSON.stringify(v)).toBe('keep');
  return v as KeepVerdict;
}
function asSafe(v: Verdict): SafeVerdict {
  expect(v.kind, JSON.stringify(v)).toBe('safe');
  return v as SafeVerdict;
}
const line = (v: KeepVerdict | SafeVerdict, slug: string): TargetLine => {
  const found = v.targets.find((target) => target.slug === slug);
  expect(found, `no line for ${slug}`).toBeDefined();
  return found!;
};

const ingredients = index.weapons.filter((weapon) => weapon.usedToBuild.length > 0);

// ------------------------------------------------------------------ fixtures

describe('fixtures from docs/verdict-rules.md', () => {
  it('1. Braton, empty arsenal: safe, not an ingredient', () => {
    const v = asSafe(verdict('braton', {}));
    expect(v.basis).toBe('not-an-ingredient');
    expect(v.mastery).toEqual({ kind: 'maybe-unmastered', maxRank: 30, mastery: 3000 });
  });

  it('2. Bolto, empty arsenal: check, listing what it builds', () => {
    const v = verdict('bolto', {});
    expect(v.kind).toBe('check');
    if (v.kind !== 'check') return;
    expect(v.targets).toEqual([
      { slug: 'akbolto', copies: 2, chains: [['akbolto', 'akjagara']] },
      { slug: 'hystrix', copies: 1, chains: [] },
    ]);
  });

  it('3. Bolto, nothing owned: keep 3, two for Akbolto and one for Hystrix', () => {
    const v = asKeep(verdict('bolto', setUp()));
    expect(v.keep).toBe(3);
    expect(line(v, 'akbolto')).toMatchObject({
      copiesPerBuild: 2,
      buildsNeeded: 1,
      copiesNeeded: 2,
      reason: 'needs-building',
      statusAssumed: true,
      chains: [['akbolto', 'akjagara']],
    });
    expect(line(v, 'hystrix')).toMatchObject({ copiesNeeded: 1, reason: 'needs-building' });
  });

  it('4. Bolto, Akbolto and Hystrix mastered: safe, all mastered', () => {
    const v = asSafe(verdict('bolto', setUp({ akbolto: s('mastered'), hystrix: s('mastered') })));
    expect(v.basis).toBe('all-mastered');
    expect(v.soft).toBe(false);
    // Akjagara is not owned, but the Akbolto in the inventory is the copy that goes into it.
    expect(line(v, 'akbolto')).toMatchObject({ buildsNeeded: 0, reason: 'mastered' });
  });

  it('5. Bolto, Akbolto owned but not levelled: safe (soft)', () => {
    const v = asSafe(verdict('bolto', setUp({ akbolto: s('owned'), hystrix: s('mastered') })));
    expect(v.basis).toBe('targets-held');
    expect(v.soft).toBe(true);
    expect(line(v, 'akbolto').reason).toBe('held-unmastered');
  });

  it('6. Bolto, Akbolto sold, Akjagara not owned: keep 2, Akbolto has to be rebuilt', () => {
    const v = asKeep(verdict('bolto', setUp({ akbolto: s('sold'), hystrix: s('mastered') })));
    expect(v.keep).toBe(2);
    expect(line(v, 'akbolto')).toMatchObject({
      buildsNeeded: 1,
      copiesNeeded: 2,
      reason: 'feeds-chain',
      chains: [['akbolto', 'akjagara']],
    });
    expect(line(v, 'hystrix').reason).toBe('mastered');
  });

  it('7. Lato, nothing owned: keep 3, through Bolto', () => {
    const v = asKeep(verdict('lato', setUp()));
    expect(v.keep).toBe(3);
    expect(line(v, 'bolto')).toMatchObject({
      buildsNeeded: 3,
      reason: 'needs-building',
      chains: [
        ['bolto', 'akbolto', 'akjagara'],
        ['bolto', 'hystrix'],
      ],
    });
  });

  it('8. Lato, whole chain mastered: safe', () => {
    const v = asSafe(
      verdict(
        'lato',
        setUp({
          bolto: s('mastered'),
          akbolto: s('mastered'),
          hystrix: s('mastered'),
          akjagara: s('mastered'),
        })
      )
    );
    expect(v.basis).toBe('all-mastered');
  });

  it('9. Dual Skana, one of three recipes outstanding: keep 1, three lines', () => {
    const v = asKeep(
      verdict('dual-skana', setUp({ akjagara: s('mastered'), redeemer: s('sold') }))
    );
    expect(v.keep).toBe(1);
    expect(v.targets.map((t) => [t.slug, t.reason, t.copiesNeeded])).toEqual([
      ['akjagara', 'mastered', 0],
      ['dark-split-sword', 'needs-building', 1],
      // Sold means mastered, and Redeemer builds nothing, so it never needs rebuilding.
      ['redeemer', 'mastered', 0],
    ]);
  });

  it('10. Viper, Twin Vipers mastered: keep 1 for Hystrix', () => {
    const v = asKeep(verdict('viper', setUp({ 'twin-vipers': s('mastered') })));
    expect(v.keep).toBe(1);
    expect(line(v, 'hystrix').copiesNeeded).toBe(1);
    expect(line(v, 'twin-vipers').reason).toBe('mastered');
  });

  it('11. Lex Prime: the non-Prime Aklex does not satisfy Aklex Prime', () => {
    const v = asKeep(verdict('lex-prime', setUp({ aklex: s('mastered') })));
    expect(v.keep).toBe(2);
    expect(v.targets.map((t) => t.slug)).toEqual(['aklex-prime']);
  });

  it('12. Mutalist Cernos, one held: keep 1, you have 1, level it first', () => {
    const v = asKeep(verdict('mutalist-cernos', { 'mutalist-cernos': s('owned', 1) }));
    expect(v.keep).toBe(1);
    expect(v.have).toBe(1);
    expect(v.mastery).toEqual({ kind: 'unmastered', maxRank: 30, mastery: 3000 });
  });

  it('13. Cernos, nothing owned: keep 1, with the chain to Proboscis Cernos', () => {
    const v = asKeep(verdict('cernos', setUp()));
    expect(v.keep).toBe(1);
    expect(line(v, 'mutalist-cernos').chains).toEqual([['mutalist-cernos', 'proboscis-cernos']]);
  });

  it('14. one unrelated status is enough to leave Check behind', () => {
    expect(verdict('bolto', setUp()).kind).toBe('keep');
    expect(verdict('bolto', { 'kuva-bramma': s('owned') }).kind).toBe('keep');
  });
});

// ------------------------------------------------------------------ beyond the table

describe('quantities, statuses and mastery', () => {
  it('holding more than recipes need makes the surplus safe to sell', () => {
    const v = asSafe(verdict('bolto', setUp({ bolto: s('owned', 4) })));
    expect(v).toMatchObject({ basis: 'surplus', keep: 3, have: 4 });
    expect(asKeep(verdict('bolto', setUp({ bolto: s('owned', 3) }))).have).toBe(3);
  });

  it('a held ingredient feeds what it can, and the rest is outstanding', () => {
    // Bolto is mastered with one copy, but Akbolto and Hystrix still consume three.
    const v = asKeep(verdict('lato', setUp({ bolto: s('mastered', 1) })));
    expect(v.keep).toBe(2);
    expect(line(v, 'bolto')).toMatchObject({ buildsNeeded: 2, reason: 'feeds-chain' });
  });

  it('keeps Prime and non-Prime apart in both directions', () => {
    expect(asKeep(verdict('lex', setUp({ 'aklex-prime': s('mastered') }))).keep).toBe(2);
  });

  it('quotes rank 40 and 4,000 mastery for weapons that level to 40', () => {
    const v = asSafe(verdict('paracesis', {}));
    expect(v.mastery).toEqual({ kind: 'maybe-unmastered', maxRank: 40, mastery: 4000 });
    expect(explain(v, graph).mastery).toContain('4,000 mastery');
  });

  it('drops the mastery note once the weapon is mastered or sold', () => {
    expect(verdict('braton', { braton: s('mastered') }).mastery).toBeNull();
    expect(verdict('braton', { braton: s('sold') }).mastery).toBeNull();
  });

  it('treats an owned weapon with a nonsense quantity as one copy', () => {
    const v = asKeep(verdict('mutalist-cernos', { 'mutalist-cernos': s('owned', 0) }));
    expect(v.have).toBe(1);
  });
});

// ------------------------------------------------------------------ properties

/** mulberry32: small, seeded, and good enough to make the random walk reproducible. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The copies a verdict says to keep. Zero for a plain safe, the need for surplus and keep. */
const need = (v: Verdict) => (v.kind === 'check' ? Number.NaN : v.keep);

describe('properties over all 46 ingredient weapons', () => {
  it('starts from the real graph: 46 ingredients, no cycles, nothing dropped', () => {
    expect(ingredients).toHaveLength(46);
    expect(graph.warnings).toEqual([]);
  });

  it('empty arsenal: every ingredient is Check, every other weapon is safe', () => {
    const evaluator = createEvaluator(graph, {});
    for (const weapon of index.weapons) {
      const v = evaluator.verdict(weapon.slug);
      expect(v.kind, weapon.slug).toBe(weapon.usedToBuild.length > 0 ? 'check' : 'safe');
    }
  });

  it('everything mastered: every ingredient is safe', () => {
    const arsenal: Arsenal = Object.fromEntries(
      index.weapons.map((weapon) => [weapon.slug, s('mastered')])
    );
    const evaluator = createEvaluator(graph, arsenal);
    for (const weapon of ingredients) {
      const v = asSafe(evaluator.verdict(weapon.slug));
      expect(v.basis, weapon.slug).toBe('all-mastered');
    }
  });

  it('nothing owned: every ingredient is Keep, and the number adds up three ways', () => {
    const arsenal = setUp();
    const evaluator = createEvaluator(graph, arsenal);
    const demand = createDemand(graph, arsenal);
    for (const weapon of ingredients) {
      const v = asKeep(evaluator.verdict(weapon.slug));
      expect(v.keep, weapon.slug).toBeGreaterThanOrEqual(1);
      expect(v.keep, weapon.slug).toBe(demand.consumedByChildren(weapon.slug));
      expect(v.keep, weapon.slug).toBe(v.targets.reduce((n, t) => n + t.copiesNeeded, 0));
    }
  });

  it('recording progress never makes any verdict stricter (seeded random walk)', () => {
    // notOwned needs the most copies, then sold, then owned and mastered (which need the same).
    const ladder: OwnershipStatus[] = ['notOwned', 'sold', 'owned', 'mastered'];
    const relevant = [
      ...new Set(index.weapons.flatMap((w) => (w.usedToBuild.length ? [w.slug, ...w.usedToBuild.map((e) => e.slug)] : []))),
    ].sort();
    expect(relevant).toHaveLength(87);

    const random = rng(1704);
    const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)]!;

    for (let round = 0; round < 300; round++) {
      const before: Record<string, ArsenalEntry | undefined> = { ...MARKER };
      for (const slug of relevant) {
        const status = pick(ladder);
        if (status === 'notOwned') continue;
        before[slug] =
          status === 'owned' || status === 'mastered' ? s(status, 1 + Math.floor(random() * 3)) : s(status);
      }

      // One step of progress on one weapon: up the ladder keeping any copies already held, or one
      // more copy once it is at the top.
      const target = pick(relevant);
      const current = before[target] ?? s('notOwned');
      const after = { ...before };
      const next = ladder[ladder.indexOf(current.status) + 1];
      if (next === undefined) after[target] = s('mastered', (current.qty ?? 1) + 1);
      else if (next === 'sold') after[target] = s('sold');
      else if (next === 'owned') after[target] = s('owned', 1);
      else after[target] = s('mastered', current.qty ?? 1);

      const was = createEvaluator(graph, before);
      const now = createEvaluator(graph, after);
      for (const weapon of ingredients) {
        const a = was.verdict(weapon.slug);
        const b = now.verdict(weapon.slug);
        const context = `round ${round}: ${target} ${current.status} -> ${after[target]!.status}, checking ${weapon.slug}`;
        expect(need(b), context).toBeLessThanOrEqual(need(a));
        if (a.kind === 'safe') expect(b.kind, context).toBe('safe');
      }
    }
  });
});

// ------------------------------------------------------------------ explanations

describe('explanations', () => {
  const say = (slug: string, arsenal: Arsenal) => explain(verdict(slug, arsenal), graph);

  it('Bolto, nothing owned', () => {
    const e = say('bolto', setUp());
    expect(e.headline).toBe('Keep 3');
    expect(e.tone).toBe('keep');
    expect(e.summary).toBe("Recipes you haven't finished need 3 copies of Bolto.");
    expect(e.lines).toEqual([
      '2 for Akbolto, on the way to Akjagara (Akbolto not marked yet).',
      '1 for Hystrix (Hystrix not marked yet).',
    ]);
    expect(e.chains).toEqual(['Bolto → Akbolto → Akjagara']);
    expect(e.copyText).toBe('Bolto: Keep 3. 2 for Akbolto, on the way to Akjagara. 1 for Hystrix.');
  });

  it('Lato shows the full chain the spec describes', () => {
    const e = say('lato', setUp());
    expect(e.lines).toEqual([
      '3 for Bolto, which you need to build 3 times, on the way to Akjagara and Hystrix (Bolto not marked yet).',
    ]);
    expect(e.chains).toEqual(['Lato → Bolto → Akbolto → Akjagara', 'Lato → Bolto → Hystrix']);
  });

  it('Bolto when Akbolto must be rebuilt for Akjagara', () => {
    const e = say('bolto', setUp({ akbolto: s('sold'), hystrix: s('mastered') }));
    expect(e.lines).toEqual(['2 for Akbolto, which Akjagara still needs.', 'Hystrix is already mastered.']);
  });

  it('the soft safe uses the wording from spec 5.2', () => {
    const e = say('bolto', setUp({ akbolto: s('owned'), hystrix: s('mastered') }));
    expect(e.headline).toBe('Safe to sell');
    expect(e.tone).toBe('safe-soft');
    expect(e.lines).toContain('You already own Akbolto. Level it before selling that.');
  });

  it('Check lists what it builds and asks for the arsenal', () => {
    const e = say('bolto', {});
    expect(e.headline).toBe('Check');
    expect(e.summary).toBe(
      'Bolto is used to build Akbolto (2 copies) and Hystrix (1 copy). Mark those weapons in your arsenal to see whether you still need it.'
    );
    expect(e.lines).toEqual(['Akbolto: 2 copies, then Akjagara.', 'Hystrix: 1 copy.']);
  });

  it('a weapon that builds nothing, with the mastery reminder', () => {
    const e = say('braton', {});
    expect(e.summary).toBe("Braton isn't used in any recipe.");
    expect(e.mastery).toBe(
      "If Braton isn't rank 30 yet, level it before you sell it: that's 3,000 mastery, and it stays after you sell."
    );
  });

  it('surplus names how many are spare', () => {
    const e = say('bolto', setUp({ bolto: s('owned', 5) }));
    expect(e.headline).toBe('Safe to sell 2');
    expect(e.summary).toBe('You need 3 and have 5, so 2 are spare.');
  });

  it('never uses an em or en dash, and chat text stays plain ASCII, for every weapon', () => {
    const everythingMastered: Arsenal = Object.fromEntries(
      index.weapons.map((weapon) => [weapon.slug, s('mastered')])
    );
    for (const arsenal of [{}, setUp(), everythingMastered]) {
      const evaluator = createEvaluator(graph, arsenal);
      for (const weapon of index.weapons) {
        const e = explain(evaluator.verdict(weapon.slug), graph);
        const text = [e.headline, e.summary, ...e.lines, ...e.chains, e.mastery ?? ''].join('\n');
        expect(text, weapon.slug).not.toMatch(/[\u2013\u2014]/);
        expect(e.copyText, weapon.slug).toMatch(/^[\x20-\x7e]+$/);
      }
    }
  });
});

// ------------------------------------------------------------------ graph construction

describe('graph construction', () => {
  const edge = (slug: string, copies = 1) => ({ slug, copies });

  it('breaks a recipe cycle instead of hanging, and says so', () => {
    const looped = createGraph([
      { slug: 'a', name: 'A', usedToBuild: [edge('b')], madeFrom: [edge('c')] },
      { slug: 'b', name: 'B', usedToBuild: [edge('c')], madeFrom: [edge('a')] },
      { slug: 'c', name: 'C', usedToBuild: [edge('a')], madeFrom: [edge('b')] },
    ]);
    expect(looped.warnings).toEqual(['recipe cycle: c -> a closes a loop; edge dropped']);
    expect(looped.get('c').usedToBuild).toEqual([]);
    expect(looped.get('a').madeFrom).toEqual([]);
    expect(asKeep(computeVerdict(looped, { z: s('owned') }, 'a')).keep).toBe(1);
  });

  it('drops references to weapons that do not exist', () => {
    const g = createGraph([{ slug: 'a', name: 'A', usedToBuild: [edge('ghost')], madeFrom: [] }]);
    expect(g.get('a').usedToBuild).toEqual([]);
    expect(g.warnings).toHaveLength(1);
  });

  it('leaves the caller data untouched', () => {
    const input = [
      { slug: 'a', name: 'A', usedToBuild: [edge('b'), edge('ghost')], madeFrom: [] },
      { slug: 'b', name: 'B', usedToBuild: [], madeFrom: [edge('a')] },
    ];
    const snapshot = JSON.stringify(input);
    createGraph(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('throws on an unknown slug rather than guessing', () => {
    expect(() => computeVerdict(graph, {}, 'not-a-weapon')).toThrow('unknown weapon');
  });
});

// ------------------------------------------------------------------ family tree

describe('family tree', () => {
  it('walks backwards from Akjagara to Lato with copy counts', () => {
    const tree = familyTree(graph, 'akjagara');
    expect(tree.usedToBuild).toEqual([]);
    expect(tree.truncated).toBe(false);
    expect(tree.madeFrom).toEqual([
      {
        slug: 'akbolto',
        copies: 1,
        status: null,
        children: [
          {
            slug: 'bolto',
            copies: 2,
            status: null,
            children: [{ slug: 'lato', copies: 1, status: null, children: [] }],
          },
        ],
      },
      { slug: 'dual-skana', copies: 1, status: null, children: [] },
    ]);
  });

  it('phase 1 depth shows one level and reports what it cut', () => {
    const tree = familyTree(graph, 'lato', { depth: 1 });
    expect(tree.usedToBuild).toEqual([{ slug: 'bolto', copies: 1, status: null, children: [] }]);
    expect(tree.truncated).toBe(true);
    expect(familyTree(graph, 'braton', { depth: 1 }).truncated).toBe(false);
  });

  it('shows statuses only once the arsenal is set up', () => {
    const tree = familyTree(graph, 'bolto', { arsenal: setUp({ akbolto: s('mastered') }) });
    expect(tree.status).toBe('notOwned');
    expect(tree.usedToBuild.map((node) => [node.slug, node.status])).toEqual([
      ['akbolto', 'mastered'],
      ['hystrix', 'notOwned'],
    ]);
  });
});
