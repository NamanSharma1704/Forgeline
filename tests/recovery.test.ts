/**
 * Hard to get back (M6.5, 12.1): the rules over what the source says, the words, and that the
 * verdict, the copied text, the sweep and the browser's graph file all carry it.
 */

import { describe, expect, it } from 'vitest';
import { decodeHard, encodeHard, fromGraphFile, toGraphFile } from '../src/data/graph-file';
import { hardToGetOf } from '../src/data/recovery';
import { getWeapon, graphWeapons } from '../src/data/weapons';
import { createEvaluator, createGraph, explain, hardToGetSentence, sweep, type HardToGet } from '../src/engine';

const graph = createGraph(graphWeapons());
const hardOf = (slug: string) => hardToGetOf(getWeapon(slug)!);

describe('which weapons are hard to get back', () => {
  it.each([
    ['broken-war', { kind: 'only', from: ['stalker'] }],
    ['nataruk', { kind: 'only', from: ['simaris'], simarisAfter: 'Complete The New War' }],
    ['lato-prime', { kind: 'vaulted' }],
    ['strun-wraith', { kind: 'event' }],
    ['prisma-gorgon', { kind: 'baro' }],
  ])('%s: %o', (slug, expected) => {
    expect(hardOf(slug)).toEqual(expected);
  });

  it.each([
    ['lato', 'nothing in the source makes it hard'],
    ['bolto', 'the Market sells its blueprint'],
    ['heliocor', 'the Market sells it, though its blueprint is from Simaris'],
    ['braton-prime', 'its relics still drop'],
    ['kuva-bramma', 'a new Lich can drop it again'],
    ['paracesis', 'the source says nothing, so no guess'],
  ])('%s: none, because %s', (slug) => {
    expect(hardOf(slug)).toBeNull();
  });

  it('counts each reason as the data has it today', () => {
    const counts: Record<string, number> = {};
    for (const weapon of graphWeapons()) {
      if (weapon.hardToGet) counts[weapon.hardToGet.kind] = (counts[weapon.hardToGet.kind] ?? 0) + 1;
    }
    expect(counts).toEqual({ vaulted: 87, only: 18, event: 15, baro: 14 });
  });
});

describe('the words', () => {
  it('names the source, and Simaris\'s condition when there is one', () => {
    expect(hardToGetSentence(hardOf('broken-war')!)).toBe(
      'Hard to get back: another one depends on drops from the Stalker, who appears only now and then.'
    );
    expect(hardToGetSentence(hardOf('nataruk')!)).toBe(
      'Hard to get back: another one depends on Cephalon Simaris, who offers it for standing once you have completed The New War.'
    );
    expect(hardToGetSentence(hardOf('xoris')!)).toMatch(/once it is unlocked through The Deadlock Protocol\.$/);
  });
});

describe('what the player is told', () => {
  const told = (slug: string) => explain(createEvaluator(graph, {}).verdict(slug), graph);

  it('Hate builds nothing and is Safe, and says it is hard to get back (M6.5 done-when)', () => {
    const e = told('hate');
    expect(e.tone).toBe('safe');
    expect(e.recovery).toMatch(/^Hard to get back: .*Stalker/);
    expect(e.copyText).toContain('Hard to get back');
  });

  it('Broken War is an ingredient (War is built from it): Check, with the same note', () => {
    const e = told('broken-war');
    expect(e.tone).toBe('check');
    expect(e.recovery).toMatch(/Stalker/);
    expect(e.copyText).not.toContain('Hard to get back'); // only said where selling is the advice
  });

  it('once War is built and mastered, Broken War is Safe, and the warning comes with it', () => {
    const e = explain(createEvaluator(graph, { war: { status: 'mastered' } }).verdict('broken-war'), graph);
    expect(e.tone).toBe('safe');
    expect(e.copyText).toContain('Hard to get back');
  });

  it('Lato says nothing of the kind', () => {
    expect(told('lato').recovery).toBeNull();
  });

  it('the sweep keeps a mastered Hate in Safe to sell, with both reasons to think twice', () => {
    const result = sweep(graph, { hate: { status: 'mastered' } });
    expect(result.safe[0]?.reason).toBe(
      'Mastered, and not used in any recipe. Hard to get back: another one depends on drops from the Stalker, who appears only now and then. It can take the Hate Incarnon Genesis: keep it if you might use that.'
    );
  });
});

describe('the browser graph file', () => {
  it('encodes every reason and reads it back unchanged', () => {
    const cases: HardToGet[] = [
      { kind: 'vaulted' },
      { kind: 'event' },
      { kind: 'baro' },
      { kind: 'only', from: ['stalker'] },
      { kind: 'only', from: ['simaris', 'stalker'], simarisAfter: 'Complete The Second Dream' },
    ];
    for (const hard of cases) expect(decodeHard(encodeHard(hard))).toEqual(hard);
  });

  it('carries it, so personal verdicts and the sweep say the same in the browser', () => {
    const fromFile = createGraph(fromGraphFile(toGraphFile(graphWeapons())));
    for (const slug of ['broken-war', 'nataruk', 'lato-prime', 'prisma-gorgon', 'lato']) {
      expect(fromFile.get(slug).hardToGet).toEqual(graph.get(slug).hardToGet);
    }
  });

  it('stays small', () => {
    expect(JSON.stringify(toGraphFile(graphWeapons())).length).toBeLessThan(45_000);
  });
});
