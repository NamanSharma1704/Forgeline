# Forgeline build plan

Companion to [Forgeline_Website_Spec.md](../Forgeline_Website_Spec.md) version 1.1. Read
[spec-review.md](spec-review.md) first for the corrections this plan assumes, and
[verdict-rules.md](verdict-rules.md) for the engine contract.

## 0. What shapes the order of work

Two things can make Forgeline wrong rather than merely unfinished: the derived data and the verdict
logic. Both are testable with no browser involved, so both come before any UI. The spec's phase 1
bundles the monthly automation with the first pages, which is right, but within that phase the
pipeline leads.

Three constraints drive every technical choice:

1. **Static output, no server** until phase 3. Every answer must come from one JSON file plus
   localStorage.
2. **Generated artifacts are committed**, so a deploy never depends on an upstream server being awake.
3. **The data refresh must be unable to publish bad data.** A silent half-break that turns Keep into
   Safe to sell is worse than a failed build.

## 1. Architecture

```
  monthly GitHub Action (1st, 06:00 UTC, plus manual trigger)
        |
        |  npm i @wfcd/items@latest
        v
  scripts/build-index.mjs ------> data/index.json        (82 KB raw, ~20 KB gzip)
  scripts/fetch-images.mjs -----> public/img/*.webp      (256 px, ~12 KB each)
                                  public/img/thumb/*.webp (96 px, ~3 KB each)
                                  data/images.manifest.json
  scripts/diff-index.mjs -------> data/changelog.json  + publish gate (pass / block)
        |
        v
  vite build  ------------------> static bundle  ------> Cloudflare Pages
        |
        v
  browser:  index.json  +  localStorage arsenal  ->  src/engine (pure)  ->  pages
```

The engine is a pure TypeScript module with no React and no I/O. The UI only renders what the engine
returns. That is what makes the fixtures in verdict-rules.md meaningful.

## 2. Repository layout

```
forgeline/
  Forgeline_Website_Spec.md
  docs/                      spec-review.md, verdict-rules.md, build-plan.md
  data/
    index.json               generated, committed
    images.manifest.json     generated, committed: source name -> sha, bytes, slugs
    changelog.json            generated, committed: added, changed, image updates
    fixtures/
      verified-recipes.json  hand-checked against the wiki, asserted by tests
      exclusions.json        entries to drop, e.g. the Doppelganger Grimoire
      aliases.json           community shorthand for search: akbo, dsword, tonk
  public/img/                {slug}.webp and thumb/{slug}.webp, generated, committed
  scripts/
    verify-source-data.mjs   read-only audit of the upstream package
    build-index.mjs          the Section 6 pipeline
    fetch-images.mjs         manifest-driven download and WebP conversion
    diff-index.mjs           changelog plus publish gate
  src/
    engine/                  demand.ts, verdict.ts, tree.ts, planner.ts  (pure, unit-tested)
    data/                    index loader, types, slug lookup
    store/                   arsenal store, schema version, migrations, export and import
    features/               search, sellcheck, arsenal, sweep, planner, ingredients
    components/              WeaponImage, VerdictBanner, StatusPicker, CopyResult, ...
    routes/                  /, /w/:slug, /ingredients, /arsenal, /sweep, /plan, /about
  .github/workflows/         ci.yml, refresh-data.yml
```

## 3. Data contract

```ts
type Slot = 'primary' | 'secondary' | 'melee' | 'arch-gun' | 'arch-melee' | 'companion';

interface Weapon {
  slug: string;              // route key, unique, stable
  name: string;
  slot: Slot;                // from productCategory, not category
  masteryReq: number;
  image: string;             // img/bolto.webp
  thumb: string;             // img/thumb/bolto.webp
  introduced: string;        // introduced.name, e.g. "Update 6.0"
  introducedDate: string;    // introduced.date, ISO
  isNew: boolean;            // added since the previous refresh
  usedToBuild: { slug: string; copies: number }[];
  madeFrom:    { slug: string; copies: number }[];
  resources?:  { name: string; count: number }[];   // display only, never tracked
  aliases?: string[];
}

interface Index {
  schema: 1;
  generatedAt: string;       // ISO, printed in the footer
  sourceVersion: string;     // @wfcd/items version, printed in the footer
  gameUpdate: string;        // newest introduced.name across weapons
  counts: { weapons: number; ingredients: number; masterable: number };
  weapons: Weapon[];
}
```

Cross-references use `slug`, not `name`: smaller, and immune to upstream renames. Measured on the
real data, this exact shape for all 622 player weapons is 153 KB raw and **16.5 KB gzipped**, so no
splitting or lazy loading is needed. Dropping `image`, `thumb` and `isNew` and deriving them at
runtime takes it to 11 KB gzipped, which is an optimisation to keep in reserve rather than apply now.
Ship the file as `index.<contenthash>.json` so the service worker can tell builds apart.

## 4. Pipeline, step by step

`build-index.mjs`, with the corrected field shapes from spec-review.md:

1. Load the six weapon files from `@wfcd/items/data/json`.
2. Drop `masterable === false`, drop `type: "Zaw Component"` and other modular parts, drop
   `productCategory: "OperatorAmps"`, then drop anything in `fixtures/exclusions.json`. That removes
   46 entries: 668 becomes **622** player weapons, 556 of which have a recipe.
3. Build a `uniqueName -> weapon` map. This is the only reliable way to resolve ingredients.
4. Assign slugs: lowercase, non-alphanumeric to hyphen, collapse repeats. On collision, append a
   short discriminator and record both in `slug-history.json` so old URLs keep resolving.
5. For every weapon, walk `components`. Keep those whose `uniqueName` is in the map, **summing**
   `itemCount` per ingredient, since 2-copy recipes list the ingredient twice.
6. Write both directions: `usedToBuild` and `madeFrom`.
7. Read `imageName` for the source filename and `introduced.name` plus `introduced.date` for
   provenance.
8. Emit `index.json`, then validate it against a schema: every cross-reference resolves, no negative
   or zero copy counts, every weapon has an image path, slugs unique.
9. `diff-index.mjs` compares against the committed `index.json`, writes `changelog.json`, sets
   `isNew`, and either passes the publish gate or blocks it (section 8).

`fetch-images.mjs`:

- Resolve `cdn.warframestat.us/img/<imageName>` **following redirects**: it 301s to GitHub raw.
- Skip anything whose hash is already in `images.manifest.json`. A normal month fetches a handful.
- Concurrency 6 to 8, retry with exponential backoff, and on failure keep the existing asset rather
  than deleting it.
- Convert with Sharp to 256 px and 96 px WebP, `fit: inside`, preserving alpha. Measured output is
  12 KB and 3 KB per weapon. The 96 px tier is deliberate: the spec's 48 px thumbnails need 2x assets.
- Dedupe by source `imageName` (11 weapons share art) and write one output per slug.
- Write per-slot silhouette fallbacks once, by hand, for the missing-image case.

## 5. Application structure

| Route | Phase | Notes |
| --- | --- | --- |
| `/` | 1 | Search box, verdict result inline, "New this month" strip, `/` key focus |
| `/w/:slug` | 1 | Verdict, recipe details, family tree, introduced-in, copy result |
| `/ingredients` | 1 | The computed ingredient list, sortable, filterable |
| `/about` | 1 | Data source, refresh dates, disclaimer, how to report an error |
| `/arsenal` | 2 | Checklist, guided 87-weapon setup first, full list behind a filter |
| `/sweep` | 2 | Owned weapons split into safe and keep |
| `/plan` | 2 | Target weapon, full transitive requirement, still-to-get list |

State: one `arsenal` store (`{ schema, statuses: Record<slug, {status, qty?}>, updatedAt }`) in
localStorage, written through a versioned module with migrations from day one. Export and import is
the same JSON plus a `kind: "forgeline-arsenal"` marker, so a malformed import can be rejected
cleanly.

Search: Fuse.js over name plus aliases, with exact-prefix boost so "lex" ranks Lex above Lex Prime,
and full keyboard navigation in the dropdown. 600 entries is trivial for Fuse.

## 6. Milestones

Each milestone is shippable on its own and ends with something verifiable. Sizes are relative:
S is a sitting, M is a day or two, L is several days.

### M0. Foundations (S)

Git repository (this folder is not one yet), Vite plus React plus TypeScript, Vitest, ESLint,
Prettier, the hosting account, and CI that runs typecheck plus tests on every push.
**Done when:** a blank page deploys from a push to main.

### M1. Data pipeline and validated index (M) <- highest value

`verify-source-data.mjs`, `build-index.mjs`, `fetch-images.mjs`, `diff-index.mjs`, the schema
validation, and the committed artifacts.
**Done when:** `index.json` holds 622 weapons and exactly the 46 ingredients with the Appendix A copy
counts; a test asserts that against `fixtures/verified-recipes.json`; `public/img` holds both tiers
for every weapon at roughly 9 MB; re-running the build with unchanged input produces a byte-identical
index.

The audit half of this milestone is already done: [verify-source-data.mjs](../scripts/verify-source-data.mjs)
reproduces the graph, checks the closure, reports the problem entries and compares against the
committed fixture, and it currently exits clean.

### M2. Engine (S to M)

`demand.ts`, `verdict.ts`, `tree.ts` as pure modules, plus every fixture in verdict-rules.md and the
property test over all 46 ingredients.
**Done when:** all 14 fixtures pass and the property test passes against the live index.

### M3. Phase 1 site (M to L)

Shell, dark theme, search, result card, weapon page with one level of tree, ingredient index, About,
footer provenance, New badges, image component with lazy loading and silhouette fallback.
**Done when:** a cold visit on a phone answers "what does Bolto build?" in under five seconds on a
throttled 4G profile, and every verdict on the page is a Check or Safe with a stated reason.

### M4. Monthly automation (S to M)

`refresh-data.yml` with the schedule, the manual trigger, the publish gate, the changelog, and a
GitHub issue on failure.
**Done when:** a manual run on unchanged data skips the deploy and says so; a run with a deliberately
corrupted source blocks the deploy, opens an issue, and leaves the live site on last month's data.

### M5. Arsenal and personal verdicts (M to L)

The store with migrations, status pickers, the guided 87-weapon setup, the full checklist with
filters and progress, export and import, starter-weapon shortcut, then the full verdict rules wired
into the result card and the tree, then `/sweep`.
**Done when:** marking Akbolto as mastered flips Bolto from Keep to Safe to sell with the right
reason, and an export reimports losslessly into a cleared browser.

### M6. Planner, full tree, offline (M)

`/plan` with transitive requirements, full-depth tree (maximum depth 3, so no special handling), PWA
install and offline, light theme.
**Done when:** the site loads offline after one visit, and a new monthly build prompts a reload
rather than silently serving stale data.

### M7. Phase 3 (L, only after the core is proven)

Share links and the clan page on Supabase, non-weapon ingredients (Warframe, companion and Archwing
parts), translations from the package's i18n data.

Spec phases map as: phase 1 is M0 to M4, phase 2 is M5 to M6, phase 3 is M7.

## 7. Quality gates

| Gate | Threshold |
| --- | --- |
| Verdict fixtures | All pass, including the property test over all 46 ingredients |
| Verified-recipe fixture | Derived graph matches the wiki-checked rows exactly |
| Index schema | Every cross-reference resolves, slugs unique, copy counts at least 1, every weapon has an image |
| Index size | At most 40 KB gzipped (currently 16.5 KB) |
| Image set | Every weapon has both tiers, total at most 20 MB (currently about 9 MB) |
| Lighthouse on `/` | Performance at least 95 mobile, Accessibility 100 |
| Verdict presentation | Icon plus word plus colour, never colour alone, contrast at least 4.5:1 on both themes |
| Alt text | Every weapon image carries the weapon name |

## 8. The monthly refresh, in detail

```
schedule: 1st of the month 06:00 UTC   +   workflow_dispatch
steps:
  1  npm install @wfcd/items@latest, record the resolved version
  2  node scripts/build-index.mjs            -> data/index.next.json
  3  schema validation                        fail -> stop, no deploy
  4  node scripts/diff-index.mjs              publish gate:
        - ingredient count moved more than 20 percent       -> block
        - any previously known ingredient disappeared        -> block
        - any weapon lost its image                          -> block
        - nothing changed at all                             -> skip deploy, exit 0
  5  node scripts/fetch-images.mjs           incremental, retries, never deletes
  6  npm test                                 fail -> stop, no deploy
  7  commit index.json, manifest, changelog, new images; deploy
  on failure or block: open a GitHub issue with the diff, leave the live site untouched
```

Notes: scheduled runs on shared runners can be late, and GitHub disables schedules in a repository
with no activity for 60 days, so the manual trigger is a first-class path and the footer prints the
real `generatedAt` from the build rather than a promise. Keep `warframe-public-export-plus` wired up
as a fallback source behind a flag, not as a live dependency.

## 9. Hosting and deploy

Cloudflare Pages, free tier, deployed by GitHub Actions. It is fast worldwide, caches the WebP set
well, supports a custom domain and needs no server. GitHub Pages works too but has a 1 GB soft limit
and slower cache behaviour. Either is reversible. The domain is not, so register it before the About
copy is written, and keep "Warframe" out of it.

Cookieless Cloudflare Web Analytics is the only measurement that fits the no-accounts,
non-commercial posture. Without it, the five-second goal in section 12 is unmeasurable and should be
stated as a design intent instead.

## 10. Deliberately not in this plan

- No AlecaFrame integration, no game-file or account reading, no market data. All non-goals in the
  spec, and all still right.
- No accounts and no server before M7.
- No 668-weapon mastery tracker before the 87-weapon verdict-relevant flow works.
- No graph library. Maximum chain depth is 3, so the tree is a handful of nested boxes.

## 11. The first three things to do

1. `git init`, push to GitHub, scaffold Vite plus React plus TypeScript plus Vitest, and point a
   Cloudflare Pages project at it (M0).
2. Port `scripts/verify-source-data.mjs` into `build-index.mjs` and commit the first `index.json`,
   plus the image fetch (M1). The audit script already reproduces Appendix A exactly, so this is
   mostly plumbing and validation.
3. Write the engine against the fixtures in verdict-rules.md before any component exists (M2).

Open decisions that block nothing yet, but should be settled before M3 ships: the domain, the
branding line, and whether analytics exist at all. The recommendations are in section 5 of
spec-review.md.
