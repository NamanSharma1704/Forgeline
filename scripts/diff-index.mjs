#!/usr/bin/env node
/**
 * Forgeline: compare a freshly built index with the committed one and decide whether it may publish.
 *
 * Usage:
 *   node scripts/diff-index.mjs --old data/index.json --new data/index.next.json
 *        [--accept] [--changelog data/changelog.json] [--report refresh-report.md] [--now <iso>]
 *
 * Exit status: 0 for publish or unchanged, 1 for blocked (so a workflow step fails and reports).
 *
 * In GitHub Actions it also writes `status=<publish|unchanged|blocked>` to $GITHUB_OUTPUT and the
 * Markdown report to $GITHUB_STEP_SUMMARY. The decision logic lives in scripts/lib/refresh.mjs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { changelogEntry, decide, diffIndexes, renderReport } from './lib/refresh.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);

const oldFile = arg('old', path.join(ROOT, 'data', 'index.json'));
const newFile = arg('new', path.join(ROOT, 'data', 'index.next.json'));
const changelogFile = arg('changelog', path.join(ROOT, 'data', 'changelog.json'));
const reportFile = arg('report', path.join(ROOT, 'refresh-report.md'));
const nowIso = arg('now', new Date().toISOString());
const accept = flag('accept');

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

const report = diffIndexes(read(oldFile), read(newFile));
const decision = decide(report, { accept });

const runUrl =
  process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : undefined;
const markdown = renderReport(report, decision, { runUrl });

fs.writeFileSync(reportFile, `${markdown}\n`);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `status=${decision.status}\n`);

// The changelog records published refreshes only: the latest one plus a short history.
if (decision.status === 'publish') {
  const entry = changelogEntry(report, nowIso);
  const existing = fs.existsSync(changelogFile)
    ? read(changelogFile)
    : { schema: 1, latest: null, history: [] };
  const history = [existing.latest, ...(existing.history ?? [])].filter(Boolean).slice(0, 23);
  fs.writeFileSync(
    changelogFile,
    `${JSON.stringify({ schema: 1, latest: entry, history }, null, 2)}\n`
  );
}

console.log(`status        ${decision.status}`);
console.log(`weapons       ${report.counts.old.weapons} -> ${report.counts.next.weapons}`);
console.log(`ingredients   ${report.counts.old.ingredients} -> ${report.counts.next.ingredients}`);
console.log(
  `changes       ${report.added.length} added, ${report.removed.length} removed, ` +
    `${report.recipeChanges.length} recipes, ${report.imageChanges.length} pictures, ` +
    `${report.displayChanges.length} other`
);
for (const reason of decision.reasons) console.log(`blocked       ${reason}`);
for (const reason of decision.accepted) console.log(`accepted      ${reason}`);
console.log(`report        ${path.relative(ROOT, reportFile)}`);

process.exit(decision.status === 'blocked' ? 1 : 0);
