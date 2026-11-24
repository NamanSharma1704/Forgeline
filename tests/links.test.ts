/**
 * Outside links (M6.5, 12.8): data/links.json, as scripts/fetch-links.mjs checked it against the
 * wiki and warframe.market, and the addresses built from it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { WeaponIndex } from '../src/data/types';
import { communityLinksOf } from '../src/data/weapons';

const ROOT = path.resolve(import.meta.dirname, '..');
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'index.json'), 'utf8')) as WeaponIndex;
const links = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'links.json'), 'utf8')) as {
  wiki: Record<string, string>;
  market: Record<string, string>;
};
const slugs = new Set(index.weapons.map((w) => w.slug));

describe('the checked links file', () => {
  it('names only weapons the index has', () => {
    for (const slug of [...Object.keys(links.wiki), ...Object.keys(links.market)]) expect(slugs).toContain(slug);
  });

  it('holds market item names in the market\'s own form', () => {
    for (const item of Object.values(links.market)) expect(item).toMatch(/^[a-z0-9_]+$/);
  });

  it('keeps the wiki title the wiki itself uses, not the stale one in the source', () => {
    expect(links.wiki['corvas-prime']).toBe('Corvas Prime');
  });
});

describe('the addresses', () => {
  it('builds wiki addresses the wiki answers, special characters encoded', () => {
    expect(communityLinksOf('braton').wiki).toBe('https://wiki.warframe.com/w/Braton');
    expect(communityLinksOf('ack-brunt').wiki).toBe('https://wiki.warframe.com/w/Ack_%26_Brunt');
  });

  it('links a tradable Prime set and a Syndicate weapon to the market', () => {
    expect(communityLinksOf('braton-prime').market).toBe('https://warframe.market/items/braton_prime_set');
    expect(communityLinksOf('vaykor-hek').market).toBe('https://warframe.market/items/vaykor_hek');
  });

  it('gives no market link to what cannot be traded', () => {
    expect(communityLinksOf('lato-prime').market).toBeUndefined(); // a Founders item
    expect(communityLinksOf('braton').market).toBeUndefined();
  });
});
