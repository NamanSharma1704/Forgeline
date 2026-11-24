#!/usr/bin/env node
/**
 * Forgeline: rewrite data/fixtures/verified-recipes.json from the current index, after a person has
 * reviewed a recipe change and accepted it.
 *
 * The fixture is the tests' record of the ingredient graph. When a refresh changes the graph, the
 * publish gate blocks it; once someone has checked the change against the WARFRAME Wiki, the
 * workflow re-runs with "accept recipe changes", which calls this script before the tests run.
 *
 * Rows that did not change keep their `verifiedAgainstWiki` flag. Rows that are new or changed are
 * set to false, so the fixture never claims a wiki check that did not happen.
 *
 * Usage: node scripts/update-fixture.mjs [--index data/index.json] [--fixture <file>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const indexFile = arg('index', path.join(ROOT, 'data', 'index.json'));
const fixtureFile = arg('fixture', path.join(ROOT, 'data', 'fixtures', 'verified-recipes.json'));

const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
const previous = fs.existsSync(fixtureFile)
  ? JSON.parse(fs.readFileSync(fixtureFile, 'utf8'))
  : { ingredients: [] };

const nameOf = new Map(index.weapons.map((w) => [w.slug, w.name]));
const before = new Map(previous.ingredients.map((row) => [row.name, row]));
const sameEdges = (a, b) =>
  JSON.stringify([...a].sort((x, y) => x.name.localeCompare(y.name))) ===
  JSON.stringify([...b].sort((x, y) => x.name.localeCompare(y.name)));

let kept = 0;
let changed = 0;
const ingredients = index.weapons
  .filter((weapon) => weapon.usedToBuild.length > 0)
  .sort((a, b) => a.name.localeCompare(b.name, 'en'))
  .map((weapon) => {
    const usedToBuild = weapon.usedToBuild
      .map((edge) => ({ name: nameOf.get(edge.slug) ?? edge.slug, copies: edge.copies }))
      .sort((a, b) => a.name.localeCompare(b.name, 'en'));
    const was = before.get(weapon.name);
    const unchanged = was && was.slot === weapon.slot && sameEdges(was.usedToBuild, usedToBuild);
    if (unchanged) kept++;
    else changed++;
    return {
      name: weapon.name,
      slot: weapon.slot,
      usedToBuild,
      verifiedAgainstWiki: unchanged ? Boolean(was.verifiedAgainstWiki) : false,
    };
  });

const removed = previous.ingredients.filter(
  (row) => !ingredients.some((next) => next.name === row.name)
).length;

const fixture = {
  $comment: previous.$comment,
  schema: 1,
  sourceVersion: index.sourceVersion,
  capturedAt: index.generatedAt.slice(0, 10),
  counts: { ingredients: ingredients.length },
  ingredients,
};
fs.writeFileSync(fixtureFile, `${JSON.stringify(fixture, null, 2)}\n`);

console.log(
  `fixture       ${ingredients.length} ingredients: ${kept} unchanged, ${changed} new or changed ` +
    `(marked unverified), ${removed} removed`
);
