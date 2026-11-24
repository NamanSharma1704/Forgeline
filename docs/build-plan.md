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

### Stack: Next.js and React, not Vite

Spec section 9 suggests Vite with React. The build uses **Next.js 16 with the App Router, React 19
and TypeScript**, exporting a fully static site (`output: 'export'`).

What that buys, beyond preference:

- **Every weapon page is pre-rendered HTML.** 621 pages come out of the build with their recipe
  content already in the markup, so "what does Bolto build?" is answered by the first byte, with no
  client fetch and no JavaScript needed to read it. Google indexes each weapon page, which is the
  realistic way a player finds the site at the moment they are about to sell something. A Vite SPA
  would have shipped one shell and rendered the answer client side.
- **File-based routing matches the page table in spec section 7** with no router wiring.
- **`output: 'export'` is a guard, not just a setting.** The build fails if a page ever reaches for a
  request-time feature, which keeps the no-server constraint honest while the site stays static.

What it costs: a heavier dev dependency than Vite, and the discipline of keeping client-only code
(localStorage, Fuse.js search, the arsenal store) behind `'use client'`. Next's image optimiser is
switched off, since the build already produces exactly the two sizes the site serves.

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
  next build (output: export) --> out/  621 pre-rendered weapon pages  --> Vercel, on push
        |                               + /, /ingredients, /about
        v
  browser:  trimmed search index  +  localStorage arsenal  ->  src/engine (pure)  ->  UI
```

The engine is a pure TypeScript module with no React and no I/O. The UI only renders what the engine
returns. That is what makes the fixtures in verdict-rules.md meaningful.

## 2. Repository layout

What exists today is marked `[x]`.

```
forgeline/
  [x] Forgeline_Website_Spec.md
  [x] docs/                      spec-review.md, verdict-rules.md, build-plan.md
  data/
    [x] index.json               generated, committed (238 KB pretty-printed, 16.5 KB gzipped)
    [x] images.manifest.json     generated, committed: source name -> sha256, bytes, slugs
        changelog.json           generated, committed: added, changed, image updates (M4)
    fixtures/
    [x] verified-recipes.json    the 46 ingredients, asserted by tests, wiki check pending
    [x] exclusions.json          entries to drop, with a reason each
    [x] aliases.json             community shorthand for search: akbo, dss, bwar
  [x] public/img/                {slug}.webp (256 px) and thumb/{slug}.webp (96 px), committed
  scripts/
    [x] verify-source-data.mjs   read-only audit of the upstream package
    [x] build-index.mjs          the section 6 pipeline, deterministic output
    [x] fetch-images.mjs         manifest-driven download and WebP conversion
        diff-index.mjs           changelog plus publish gate (M4)
  src/
    [x] app/                     App Router: layout, page, ingredients/, about/, w/[slug]/
    [x] components/              WeaponArt, and the verdict and search components to come
    [x] data/                    types.ts, weapons.ts (build-time index access and graph walks)
        engine/                  demand.ts, verdict.ts, tree.ts, planner.ts (pure, M2)
        store/                   arsenal store, schema version, migrations, export and import (M5)
        features/                search, sellcheck, arsenal, sweep, planner (M3, M5, M6)
  [x] tests/index.test.ts        index integrity and the recipe fixture
  [x] .github/workflows/ci.yml   typecheck, tests, static export
      .github/workflows/refresh-data.yml   the monthly job (M4)
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

Server and client split, which is the one thing the App Router makes you decide up front:

- **Server components by default.** Pages import `data/index.json` directly, so the recipe content is
  baked into the HTML at build time and the browser downloads no data to read a weapon page.
- **`'use client'` only where the browser is genuinely needed:** the search box (Fuse.js), the
  arsenal store (localStorage), status pickers, the theme toggle, and `WeaponArt`, which needs an
  error handler for the missing-image fallback.
- **Verdicts render twice over the site's life:** statically as Check (no arsenal known at build
  time), then re-rendered in the browser once the stored arsenal is read. The engine is the same pure
  module in both passes, so there is one implementation of the rules and no server round trip.
- **The client gets a trimmed index**, not the build-time one: slug, name, thumb, aliases and both
  graph directions, which is what search, the arsenal and the verdicts need.

State: one `arsenal` store (`{ schema, statuses: Record<slug, {status, qty?}>, updatedAt }`) in
localStorage, written through a versioned module with migrations from day one. Export and import is
the same JSON plus a `kind: "forgeline-arsenal"` marker, so a malformed import can be rejected
cleanly.

Search: Fuse.js over name plus aliases, with exact-prefix boost so "lex" ranks Lex above Lex Prime,
and full keyboard navigation in the dropdown. 600 entries is trivial for Fuse.

## 6. Milestones

Each milestone is shippable on its own and ends with something verifiable. Sizes are relative:
S is a sitting, M is a day or two, L is several days.

### M0. Foundations (S) - done, except the linter

Git repository, Next.js 16 with the App Router, React 19, TypeScript in strict mode with
`noUncheckedIndexedAccess`, Vitest, and CI that runs typecheck, tests and the static export on every
push.
**Done when:** a page deploys from a push to main.

Built: the repository, the toolchain, `.github/workflows/ci.yml`, and a working static export of
626 pages, deployed to Vercel from every push to `main` (section 9). Outstanding: a linter (ESLint
with `eslint-config-next`, plus Prettier).

### M1. Data pipeline and validated index (M) - done, except the monthly diff

`verify-source-data.mjs`, `build-index.mjs`, `fetch-images.mjs`, `diff-index.mjs`, the schema
validation, and the committed artifacts.
**Done when:** `index.json` holds 622 weapons and exactly the 46 ingredients with the Appendix A copy
counts; a test asserts that against `fixtures/verified-recipes.json`; `public/img` holds both tiers
for every weapon at roughly 9 MB; re-running the build with unchanged input produces a byte-identical
index.

Built and verified on the real data: 621 player weapons, 46 ingredients matching the fixture exactly,
1,242 WebP files totalling 12 MB from an 18.4 MB download, a byte-identical rebuild, and 12 passing
integrity tests. `diff-index.mjs` and the changelog are the remaining piece and belong with M4, which
is the only consumer of them.

One measured surprise: 611 source images cover 621 weapons, because MK1 and some signature variants
share art with their base weapon (MK1-Braton uses `Braton.png`). Downloads dedupe by source, outputs
are written per slug.

### M2. Engine (S to M) - done

`demand.ts`, `verdict.ts`, `tree.ts` as pure modules, plus every fixture in verdict-rules.md and the
property test over all 46 ingredients.
**Done when:** all 14 fixtures pass and the property test passes against the live index.

Built in `src/engine/`: `graph.ts` (acyclic by construction), `status.ts` (the 2 x 2 model),
`demand.ts`, `verdict.ts`, `explain.ts` (every sentence the card and the Copy button will show) and
`tree.ts`. 40 tests: the 14 fixtures, four property tests including a seeded random walk, wording
tests that also forbid em and en dashes in every explanation for every weapon, graph-construction
edge cases and the family tree. Three deliberate mutations of the arithmetic were each caught.

Writing the fixtures as tests found three errors in the first draft of verdict-rules.md (fixture 9's
number, an unstated "set up" condition, and a false property), all now corrected there. The index
also gained `maxRank`, so the mastery note quotes 4,000 for the 52 weapons that level to 40.

### M3. Phase 1 site (M to L) - done, except the 4G timing check

Shell, dark theme, search, result card, weapon page with one level of tree, ingredient index, About,
footer provenance, New badges, image component with lazy loading and silhouette fallback.
**Done when:** a cold visit on a phone answers "what does Bolto build?" in under five seconds on a
throttled 4G profile, and every verdict on the page is a Check or Safe with a stated reason.

Built:

- **Search** (`src/search/rank.ts`, `WeaponSearch`). Tiered ranking (exact, name prefix, word prefix,
  substring, one or two typos, then Fuse.js): "bolot" finds Bolto, "lex" puts Lex before Lex Prime,
  "bo" puts Bo Prime second, "akbo" uses the alias file. Thumbnails in suggestions, the ARIA
  combobox pattern, `/` from any page, and the top result prefetched. The index is a 34 KB static
  file generated by a force-static route handler, so it can never drift from the pages.
- **Verdict card** (`VerdictCard`). Icon, word and colour together; the reason; one row per recipe
  with picture and a short note; the chain beyond; the mastery note with real rank and mastery;
  Copy result with a fallback. Rendered at build time from the engine with an empty arsenal, so
  every page is Check or Safe with its reason in the HTML, and phase 2 can re-render the same card
  in the browser.
- **Phase 1 Check wording.** Without an arsenal a Check now says when it is safe and gives the
  from-scratch number (`keepIfNothingBuilt`): "Keep it unless you have already built and mastered
  both. Building them from scratch takes 3 copies."
- **Family tree** (`FamilyTree`), one level each way from the engine's `familyTree`, with a "then"
  hint where a target builds further; left to right on desktop, top to bottom on phones.
- **Design pass** in the spec's emblem language: black panels with a 1 px white edge and two cut
  corners on a mid-grey ground, reserved for search, verdict, tree and the weapon's own picture.
  Barlow self-hosted by `next/font`; dark by default with a persisted light option and no flash;
  themed selection, caret, scrollbar and focus; drawn SVG icons and per-slot silhouettes. The
  design-skill detector reported no findings.
- **Ingredient index** with slot chips, a name filter and sorting, restacked on phones.

Checked on the exported site at desktop and 375 px widths, in both themes, with no hydration or
script errors. Not yet measured: the five-second answer on throttled 4G.

### M4. Monthly automation (S to M) - done

`refresh-data.yml` with the schedule, the manual trigger, the publish gate, the changelog, and a
GitHub issue on failure.
**Done when:** a manual run on unchanged data skips the deploy and says so; a run with a deliberately
corrupted source blocks the deploy, opens an issue, and leaves the live site on last month's data.

Every branch is proven locally and in 16 tests (section 8), and on GitHub: the first manual dry run
(run 45443658561, 24 November 2026) passed in 35 seconds. The gate found nothing changed, so the
promote step was skipped; the picture recheck found nothing new, so tests, export and commit were
skipped; no issue was opened and `main` was untouched. The first scheduled run is 1 December.

### M5. Arsenal and personal verdicts (M to L) - done

The store with migrations, status pickers, the guided 87-weapon setup, the full checklist with
filters and progress, export and import, starter-weapon shortcut, then the full verdict rules wired
into the result card and the tree, then `/sweep`.
**Done when:** marking Akbolto as mastered flips Bolto from Keep to Safe to sell with the right
reason, and an export reimports losslessly into a cleared browser.

Built:

- **Store** (`src/store/arsenal.ts`, pure; `useArsenal.ts`, the hook). Versioned schema with a
  migration slot, `notOwned` never stored, quantity kept only while held. Read through
  `useSyncExternalStore`, so pre-rendered pages show no status rather than a wrong one, and other
  tabs stay in step. Export file carries a `kind` marker; import refuses foreign, versionless and
  newer files with a message, skips unknown weapons and counts them.
- **Personal verdicts.** Pages still pre-render the empty-arsenal verdict; once anything is marked,
  `PersonalVerdict` loads `/graph.json` (built by a force-static route, 30 KB) and runs the same
  engine in the browser. Every recipe row on the card has a status picker, so a Check resolves in
  place, and the weapon's own status and copy count sit in the page header. Family-tree boxes show
  statuses once the arsenal is set up.
- **My Arsenal** (`/arsenal`). Opens on the 87 recipe weapons; ingredients only or all 621 are one
  chip away; filters by slot, status and name; list or picture view; mastery progress and a
  recipe-weapons-marked count; a starter shortcut where the player taps what they picked; save to a
  file, load a file (with an inline confirm before replacing) and clear (with an inline confirm).
- **Slot sweep** (`/sweep`, `src/engine/sweep.ts`). Held weapons split into Safe to sell and Keep,
  each with a one-line reason; anything not mastered stays in Keep; Mark sold on the safe ones.
- **Ingredient index** gains "Only ones I own" and status tags.

Both acceptance criteria are tested (`tests/arsenal.test.ts`) and were watched in the browser:
on Bolto's page, Akbolto to Mastered turned Check into Keep 1, Hystrix to Mastered turned it into
Safe to sell; a loaded file replaced the arsenal exactly, quantities included, skipping one unknown
weapon. Checked at desktop and 375 px with no horizontal scroll and no script errors.

Not built from this milestone's list: a dedicated step-by-step setup flow. The 87-weapon default
view with the "recipe weapons marked" count does that job; a wizard can follow if players stall.

### M6. Planner, full tree, offline (M)

`/plan` with transitive requirements, full-depth tree (maximum depth 3, so no special handling), PWA
install and offline, light theme.
**Done when:** the site loads offline after one visit, and a new monthly build prompts a reload
rather than silently serving stale data.

**Done.** What shipped:

- **Build planner** (`/plan`, `src/engine/planner.ts`). Pick a weapon; it lists every weapon down
  the chain, what is left to build or get once held copies are counted (a held Bolto covers one of
  the two Akbolto needs, and the Lato under it drop away), the steps in order, deepest first, and
  the resources those steps still cost. The status and quantity controls on each step write to the
  same arsenal as everywhere else. `?w=` makes a plan linkable, and each craftable weapon's page
  links to its own.
- **Recipe data.** The index now carries each weapon's full recipe from `@wfcd/items` (blueprint,
  parts, resources), served to the planner as `/materials.json`. Only weapons count towards
  verdicts; the rest is listed, not tracked.
- **Full-depth family tree.** Every generation each way, as columns, with a weapon reached along two
  branches shown once with both captions. A Recipe section sits under it on every weapon page.
- **Installable and offline.** A web app manifest and icons (`scripts/make-icons.mjs`), and a
  service worker generated at build time (`/sw.js`). One visit saves the core pages, the 87 recipe
  weapons' pages, the three data files and every script, style and font those pages name (read
  from their HTML, since hosts lay the build folder out differently): about 1.1 MB over the wire.
  Pages and data are network first, so online always means the live build; hashed files and
  pictures are cache first. Any other weapon page offline gets `/offline/`, which still answers from the
  recipe graph: a weapon that feeds no recipe is Safe to sell.
- **Update prompt.** Every build is a new worker version. It installs in the background and waits;
  the page shows "Forgeline has new weapon data or features" with Reload, and only that click swaps
  it in. The old cache is deleted on the swap.
- The light theme listed here shipped early, with the M3 design pass.

Both acceptance criteria were watched in headless Chrome against the static export (the desktop
app's browser pane cannot register service workers): after one online visit and with the server
stopped, Bolto, Akbolto by link click, the planner, About and search all worked, and Acceltra got
the offline answer. After a rebuild, the next visit showed the Reload bar, and Reload moved the page
to the new version's cache. The planner and tree were checked at 1200 and 390 px with no horizontal
page scroll. 117 tests.

### M6.5. Player Safety & Warframe Nuance (Player-Centric Expansion)

Addresses real player failure modes beyond pure recipe mathematics: selling hard-to-recover quest
weapons, ditching Incarnon-compatible meta weapons, accidentally sweeping potatoed/Forma'd favorites,
and setup fatigue across 621 weapons.

**Done when:** checking Broken War warns against selling despite building nothing; Torid surfaces its
Incarnon Genesis compatibility; favorited weapons are protected from the slot sweep; and a new player
can mark the 46 ingredients in a 2-minute express wizard.

Planned deliverables:

- **Re-acquisition difficulty and quest protection.** Not all weapons are equal to re-acquire. Market
  credit weapons (Braton, Lato) cost 25k credits and 0 craft time; quest weapons (Broken War, Xoris)
  cost weeks of Cephalon Simaris standing or rare drops. Weapons carry an acquisition tier:
  `market-credits` (trivial), `market-blueprint` / `clan-dojo` (standard), `quest` / `simaris` / `baro` /
  `invasion` (hard). A "Safe to sell" verdict on a hard-to-recover weapon carries a clear warning banner:
  "Hard to re-acquire: quest reward or expensive Simaris standing."
- **Incarnon Genesis compatibility badge.** Weapons with Steel Path Circuit Incarnon Genesis adapters
  (Torid, Dual Toxocyst, Bo, Furis, Lato, Lex, Angstrum, Miter, etc.) are flagged (`isIncarnonCompatible`).
  Even if all recipe targets are mastered, the verdict card reminds the player: "Incarnon Genesis
  compatible in Steel Path Circuit: high endgame power."
- **Favorite / "Potatoed" protection in Arsenal & Sweep.** Add an `invested` / `favorited` toggle (star
  or catalyst icon) to the arsenal store schema. In `/sweep`, favorited weapons are pinned to a
  protected "Keep (Invested)" tier and never suggested for sale, preventing accidental disposal of 5-Forma
  gear to free a slot.
- **Variant family & sibling links.** Display variant chips (e.g. `Normal`, `Prime`, `Kuva`, `Tenet`,
  `Prisma`, `Wraith`, `Vandal`) with contextual recipe distinctions (e.g. Lex builds Aklex, but Lex Prime
  builds Aklex Prime).
- **Express 46 Onboarding Wizard.** Replace the intimidation of a 621-item checklist with a 2-minute
  focused flow in `/arsenal`: quick-mark *only* the 46 ingredient weapons with single-tap controls,
  plus a "Mark all Market credit weapons as Mastered" bulk shortcut.
- **Foundry crafting duration in Build Planner.** Add cumulative build hours (and concurrent stages) to
  `/plan` (e.g., Akjagara: 72h total foundry time across 3 sequential stages) so players can queue
  ingredients effectively.
- **Target Recipe Resource Breakdown & Foundry Ingredients.** When the Sell Check card says
  "Used to build: Akbolto (2 copies)", players shouldn't have to leave the page or guess what else
  Akbolto requires. Add an expandable/direct **Blueprint Requirements peek** on the verdict row and
  weapon view showing the non-weapon crafting ingredients (e.g., `1x Orokin Cell`, `20,000 Credits`,
  `Akbolto Blueprint`), with visual rarity tags for bottleneck materials (Forma, Orokin Cells,
  Argon Crystals, Tellurium, Nitain Extract).
- **Direct community links.** Discreet external links on each weapon page to the Official Warframe Wiki
  (for drop locations/farming tables) and warframe.market (for tradeable Prime sets).

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
| Static export | `next build` succeeds with `output: 'export'`, so no page has crept into needing a server |

## 8. The monthly refresh, in detail

Built as `.github/workflows/refresh-data.yml`. The decisions are pure functions in
`scripts/lib/refresh.mjs`, tested in `tests/refresh.test.ts`; the workflow only runs scripts and acts
on their answers.

```
on: 1st of the month 06:00 UTC, or Run workflow (inputs: accept recipe changes, dry run)

 1  npm ci, then npm install @wfcd/items@latest
 2  build-index --out data/index.next.json       built beside the live index, never over it;
                --previous data/index.json        validation errors stop the run here
 3  diff-index (the publish gate)                 unchanged / publish / blocked
 4  publish: promote the candidate; if accepted, rewrite the recipe fixture (update-fixture)
 5  fetch-images --recheck                        re-downloads all 611 sources, converts only
                                                  what changed by hash, never deletes
 6  nothing in data/, public/img or the lockfile changed?  stop: nothing deploys
 7  npm test, then next build                     any failure stops the run
 8  commit and push to main                       Vercel deploys the push (skipped on dry run)
 on block or failure: one open issue labelled data-refresh, commented on by later runs
```

What the gate decides, and why:

| Change | Decision | Why |
| --- | --- | --- |
| Nothing, or only the package version and timestamp | **Unchanged**, nothing deploys | A version bump with identical data is not worth a deploy; the repository stays byte-identical |
| New weapons outside the recipe graph, picture changes, metadata, New badges expiring | **Publish** | None of it can change a verdict |
| Any change to the recipe graph: an ingredient gained or lost, a copy count changed | **Blocked until reviewed** | This is what decides Keep and Safe. A person checks it against the wiki, then re-runs with *accept recipe changes*, which publishes and updates the fixture, marking changed rows unverified |
| Ingredient count swings more than 20 percent, or more than 5 percent of weapons vanish | **Blocked, accepted or not** | Real updates move these by a handful; this size means a broken source |

The New badge follows the spec: a weapon is new if it was absent from the previous index, and a
second refresh in the same month (a manual run after a big update) keeps that month's badges
instead of clearing them.

Verified locally before the first scheduled run: on today's data the candidate is identical and the
gate says unchanged; the picture recheck downloaded 18.4 MB, found all 611 unchanged and left every
file byte-identical; a simulated picture change publishes and writes the changelog; a simulated lost
ingredient exits 1 with a report that names Lato and says what to do; `update-fixture` reproduces
the current fixture exactly. The workflow file parses, and a YAML error it had was caught that way.

Notes: scheduled runs on shared runners can be late, and GitHub disables schedules in a repository
with no activity for 60 days, which a quiet month (no commit) can lead to. The manual trigger is a
first-class path, and the footer prints the real `generatedAt` rather than a promise. A push made by
the workflow does not trigger the CI workflow (GitHub's rule for its own token), which is why the
refresh runs the tests and the export itself before pushing. Keep `warframe-public-export-plus` as a
fallback source behind a flag, not as a live dependency.

## 9. Hosting and deploy

**Decided: GitHub holds everything, Vercel serves the site.** GitHub is the source of truth for the
code, the generated index and all 1,242 images. Vercel's Git integration reads the repository on
every push to `main`, runs `next build`, and serves the static `out/` directory. Nothing lives only
on Vercel: delete the Vercel project and the repository is untouched and can be deployed anywhere
else, since the export is plain HTML, CSS, JS and WebP. `trailingSlash: true` keeps the
directory-style URLs identical on any static host.

| | |
| --- | --- |
| Repository | `NamanSharma1704/Forgeline` on GitHub, production branch `main` |
| Vercel project | `forgeline`, in the `souldevourer17's projects` team, Hobby (free) plan |
| Production URL | https://forgeline-arsenal.vercel.app |
| Deploys | Automatic on every push to `main`; a build takes about 20 seconds |
| Checks | GitHub Actions CI runs typecheck, tests and the export on the same push |

The Hobby plan is for non-commercial use, which matches the Content Policy's terms for the weapon
art: the site stays free, with no ads and no paywall.

One portability caveat, found while testing the export locally. Next 16 writes each route's prefetch
data as nested files (`/w/bolto/__next.w/$d$slug/__PAGE__.txt`) but the browser asks for a dotted
name (`/w/bolto/__next.w.$d$slug.__PAGE__.txt`). Vercel maps one to the other, so the live site is
fine. A plain static host (nginx, GitHub Pages) would answer those prefetches with 404s, and links
would fall back to slower full navigations, unless it rewrites dots to slashes for `__next.` paths.
Worth remembering only if hosting ever moves.

Two details to tidy later. Vercel builds with Node 26 while CI tests on Node 20; both pass today,
but pinning one version in `package.json` `engines` and in the Vercel project settings keeps them
from drifting. And the domain is still open: a custom domain can point at the Vercel project at any
time, and is the one hosting decision that is hard to reverse, so register it before the About copy
is finalised and keep "Warframe" out of it.

Analytics, if any, should stay cookieless to fit the no-accounts, non-commercial posture. Vercel's
own Web Analytics is the natural candidate now that the site is there. Without some measurement,
the five-second goal in section 12 is unmeasurable and should be stated as a design intent instead.

## 10. Deliberately not in this plan

- No AlecaFrame integration, no game-file or account reading, no market data. All non-goals in the
  spec, and all still right.
- No accounts and no server before M7.
- No 668-weapon mastery tracker before the 87-weapon verdict-relevant flow works.
- No graph library. Maximum chain depth is 3, so the tree is a handful of nested boxes.

## 11. Where this stands, and the next three things

Done: M0 to M6. Phases 1 and 2 of the spec are complete: a player can mark their arsenal and every
verdict, tree, sweep and build plan becomes about their own weapons, on a phone home screen and
offline. The data refreshes itself monthly behind a gate that cannot publish a broken recipe graph,
and each refresh reaches players as a Reload prompt rather than silently. 138 tests, CI, and every
push deployed by Vercel.

Since M6, variants are separated. Each weapon is classed as Normal, Prime, Kuva/Tenet/Coda,
Vandal/Wraith, Prisma, Syndicate or another variant line (MK1, Dex, Mutalist and a few singles),
read from its name in `src/data/variants.ts`, since the source has no field for it. My Arsenal and
the ingredient list filter by variant, and each weapon page links its other versions (Braton to
Braton Prime, Braton Vandal and Mk1-Braton), because each is a separate weapon to master and sell.

The visual direction has moved on from spec section 8. The Tenno Foundry HUD plan
(`docs/design-plan.md`, kept out of git) replaces the flat emblem look in five phases. Phase 1, the
foundations, is done: a void ground with ambient light and a fine grid, three surface levels, lit
panel edges, verdict-coloured light inside the verdict card, cyan selection, and a glass header that
sticks from tablet width up. Every text colour was measured against every surface it sits on:
4.5:1 or better in both themes, and the light verdict colours at 5.5:1 or better on white.

M6.5 has started. Favourites (12.3) are done: a held weapon can be starred on its page, in My
Arsenal or in the sweep, and the sweep puts it under Favourites instead of ever suggesting its sale.
The Incarnon flag (12.2) is done too: the index records the 45 Genesis adapters on the weapons they
are named for, and the wiki's rule carries each to that weapon's versions (90 weapons; never Akimbo
or Dual ones). The weapon page shows a badge, the verdict card and copied text say it without
changing the verdict, and the sweep adds it to a Safe reason. The Circuit's week-by-week rotation is
left out: it is not in the data and could not be verified.
Foundry time (12.6) is done as well. The index carries each weapon's build time from `@wfcd/items`
(86 of the 87 recipe weapons; Lex has none, and the planner says so instead of guessing). The
planner groups what is left into stages, and gives two totals: the fastest, with every build
started as soon as its ingredients are ready (the Foundry runs any number at once, so only the
slowest chain counts), and one build at a time. Akjagara from nothing is 48 hours at best and 84
one at a time, not the 72 hours in 12.6's example: every step in it takes 12 hours.
No schema bump: the flag is optional, so an old tab left open after a deploy still reads the arsenal
rather than treating it as unreadable and writing an empty one back. What the data allows for the
rest: build times, credit costs, vault status and the 45 Incarnon Genesis adapters are all in
`@wfcd/items`, so 12.2, 12.6 and 12.7 need no hand-kept lists. Quest and Simaris re-acquisition
(12.1) and "bought for credits" (the 12.5 preset) are not in it and need a curated, reviewed list.
One correction to 12.5: marking only the 46 ingredients does not make verdicts exact, because an
ingredient's verdict turns on whether its targets are built and mastered. The wizard should cover the
87 recipe weapons, ingredients and targets both.

Next, in order:

1. **Check the worker on the live site.** After the M6 deploy: install from Chrome on a phone,
   confirm `/sw.js` and `/offline/` are served as they are locally, and that the next deploy
   shows the Reload bar.
2. **Measure the five-second goal.** A throttled 4G run against the live site, so M3's last
   acceptance criterion is a number rather than an assumption. Repeat visits are now served from
   the cache, so measure a first visit.
3. **Watch the 1 December run.** The first scheduled refresh. Expect "unchanged" unless
   `@wfcd/items` publishes a game update before then.
4. **Implement M6.5 (Player-Centric Expansion).** Deliver re-acquisition warnings (quest/Simaris
   protection), Incarnon Genesis compatibility flags, favorited weapon protection in Slot Sweep,
   variant links, and the 2-minute Express 46 onboarding wizard.

M7 (phase 3) waits until the core and M6.5 have been used by real players.

Hosting is settled (section 9). Open decisions that block nothing yet, but should be settled before
M3 ships: the domain, the branding line, and whether analytics exist at all. The recommendations are
in section 5 of [spec-review.md](spec-review.md).

## 12. Changes made by Naman

The following player-centric improvements and specifications were conceived and introduced to solve real *Warframe* player pain points beyond pure recipe mathematics (codified in Milestone M6.5). Each entry details the motivation, schema changes, engine logic, UI presentation, and verification criteria.

---

### 12.1. Re-acquisition Difficulty & Quest Protection

#### Problem & Context
In *Warframe*, not all weapons are equal to replace. A `Lato` or `Lex` can be re-purchased from the in-game Market for 25,000 Credits and equipped instantly with 0 craft time. In contrast, quest weapons (e.g., `Broken War`, `Xoris`, `Nataruk`) and Cephalon Simaris inventory items cost 100,000+ reputation standing and require rare parts (like Stalker blade drops) to craft again. Selling a `Broken War` simply because it builds nothing today causes catastrophic player regret.

#### Data Model & Schema
In `data/types.ts` and `data/index.json`:
```ts
export type AcquisitionTier =
  | 'market-credit'    // Bought pre-built for credits (Braton, Lato, Lex, MK1 series)
  | 'market-blueprint' // Blueprint bought from market, normal foundry craft
  | 'clan-dojo'        // Researched in Tenno/Bio/Energy/Chem Lab, requires Forma
  | 'quest'            // Awarded by quest (Broken War, Xoris, Nataruk)
  | 'simaris'          // Re-bought via Cephalon Simaris standing
  | 'invasion'         // Wraith/Vandal weapon parts from invasions
  | 'baro'             // Baro Ki'Teer / Ducats
  | 'syndicate'        // Standing purchase from 6 core Syndicates
  | 'relic-vaulted'    // Prime parts currently vaulted
  | 'relic-active';    // Prime parts actively in drop tables

export interface Weapon {
  // ... existing fields
  readonly acquisition: {
    readonly tier: AcquisitionTier;
    readonly source: string;          // e.g. "Cephalon Simaris (100,000 Standing)" or "Market (25,000 Credits)"
    readonly warning?: string;        // Emitted when selling carries high recovery penalty
  };
}
```

#### Engine & UI Logic
- In `src/engine/verdict.ts`: A weapon that builds nothing still receives verdict `safe`, but carries a `recoveryWarning` field when `tier` is `'quest'`, `'simaris'`, `'invasion'`, or `'relic-vaulted'`.
- In `VerdictCard.tsx`: The card banner displays an alert badge (amber/red outline) with text:
  *"Hard to re-acquire: Quest reward / Cephalon Simaris (100,000 Standing). Keep unless you are certain you will never use it again."*
- `tests/engine.test.ts`: Verify that `broken-war` emits `safe` with a non-null `recoveryWarning`, whereas `lato` emits `safe` with no warning.

---

### 12.2. Incarnon Genesis Compatibility Flag

#### Problem & Context
The Steel Path Circuit rewards *Incarnon Genesis Adapters* for legacy weapons (`Torid`, `Dual Toxocyst`, `Angstrum`, `Bo`, `Furis`, `Lato`, `Lex`, `Miter`, `Strun`, etc.). These adapters elevate baseline weapons into top-tier endgame meta choices. If a player masters `Torid` and sells it because Forgeline says *"Safe to sell: builds nothing"*, they discard an S-tier weapon.

#### Data Model & Schema
In `data/types.ts`:
```ts
export interface Weapon {
  // ...
  readonly isIncarnonCompatible?: boolean;
  readonly incarnonRotation?: number; // 1 through 7 (Circuit rotation week)
}
```
A static fixture `data/fixtures/incarnon-weapons.json` lists all ~35 Incarnon-compatible weapon slugs.

#### Engine & UI Logic
- `src/engine/explain.ts`: Appends an Incarnon note to the explanation summary:
  *"⚡ Compatible with Steel Path Circuit Incarnon Genesis adapter (Rotation X). High endgame combat utility."*
- `VerdictCard.tsx` and `w/[slug]/page.tsx`: Display a glowing Void cyan badge `⚡ INCARNON GENESIS` in the weapon header and verdict banner.
- `tests/engine.test.ts`: Test that checking `torid` surfaces the Incarnon compatibility flag regardless of arsenal status.

---

### 12.3. Favorite / "Potatoed" Protection in Arsenal & Slot Sweep

#### Problem & Context
Players regularly install Orokin Catalysts ("potatoes"), Exilus weapon adapters, and multiple Forma into weapons they enjoy. When running `/sweep` to clear inventory space, players want the sweep to recommend selling uninvested mastery fodder—never a weapon they spent 5 Forma on.

#### Data Model & Schema
In `src/store/arsenal.ts`:
```ts
export interface StoredWeaponEntry {
  readonly status: OwnershipStatus;
  readonly quantity?: number;
  readonly isFavorited?: boolean; // Starred / Invested (Catalyst / Forma)
}
```
Store version bumped with backward-compatible migration: existing records default `isFavorited: false`.

#### Engine & UI Logic
- In `src/components/StatusPicker.tsx`: Add a toggleable star/catalyst button (`★ Favorite`).
- In `src/engine/sweep.ts`:
  ```ts
  if (entry.isFavorited) {
    keep.push({ slug, reason: 'Favorited / Invested (Protected from sale)' });
    continue;
  }
  ```
  Favorited weapons are placed in a dedicated top tier: **"Protected Gear"**, guaranteeing they never appear under "Safe to Sell".
- `tests/sweep.test.ts`: Assert that marking a weapon with `isFavorited: true` prevents it from appearing in `sweep.canSell` even if all targets are mastered.

---

### 12.4. Variant Family & Sibling Links

#### Problem & Context
*Warframe* weapons exist in variant families: `Normal`, `Prime`, `Kuva`, `Tenet`, `Prisma`, `Wraith`, `Vandal`, and `Syndicate`. Players looking at `Boltor` need to know:
1. Is there a Prime or Telos version that renders this obsolete?
2. Does my variant satisfy the recipe? (e.g. `Lex` crafts `Aklex`, but `Lex Prime` does **not** craft `Aklex`—it crafts `Aklex Prime`).

#### Data Model & Schema
Implemented in `src/data/variants.ts` and `src/data/weapons.ts`:
- Classifies each weapon into its variant line (`normal`, `prime`, `kuva-tenet-coda`, `vandal-wraith`, `prisma`, `syndicate`, `other`).
- Groups sibling weapons sharing a root name (e.g. `braton` $\rightarrow$ `braton-prime`, `braton-vandal`, `mk1-braton`).

#### UI Presentation
- In `w/[slug]/page.tsx`: A **Variant Line** ribbon rendered under the weapon title:
  `[ Normal (Current) ]  [ Prime ]  [ Vandal ]  [ MK1 ]`
- Explicit recipe distinction callouts: *"Lex Prime is not used in Aklex; it is used in Aklex Prime."*
- In `/arsenal`: Filter chips for variant types to inspect mastery by variant collection.

---

### 12.5. Express 46 Onboarding Wizard

#### Problem & Context
Forgeline contains 621 weapons. When a player opens `/arsenal`, a checklist of 621 items causes onboarding fatigue, and players abandon setup. In reality, **only 46 weapons are ingredients in other recipes**—the remaining 575 weapons have zero impact on sell verdicts.

#### UX Flow & Implementation
- In `/arsenal`: A prominent banner: **"Quick Setup (2 Minutes): Mark your 46 ingredient weapons to get 100% accurate verdicts."**
- Launches a modal/step card presenting only the 46 ingredients grouped by mastery rank requirement:
  - Single-click toggle: `[ Not Owned ]` $\rightarrow$ `[ Owned ]` $\rightarrow$ `[ Mastered ]`.
  - Preset shortcuts: **"Mark all Market Credit weapons as Mastered"** (instantly sets MK1 weapons, baseline Braton, Lato, Strun, Aklato, Lex).
- Progress indicator: `12 / 46 Ingredients Marked`. Once complete, emits celebration toast: *"Arsenal personalized! Every sell check is now tailored to your inventory."*

---

### 12.6. Foundry Crafting Duration & Staged Sequencing in Build Planner

#### Problem & Context
Crafting multi-stage weapons involves extensive Foundry wait times. For example, `Akjagara` requires:
- 2x `Bolto` (12h craft time each, 12h if built concurrently)
- 1x `Akbolto` (24h craft time)
- 2x `Skana` (Market purchase or 12h craft time)
- 1x `Dual Skana` (12h craft time)
- 1x `Akjagara` (24h craft time)
Total sequential time: **72 hours**. Players need to know the true time investment and what can be queued in parallel.

#### Engine & UI Logic
- In `src/engine/planner.ts`:
  - Extend each `PlanLine` with `buildTimeSeconds` and `concurrentStage`.
  - Calculate **Critical Path Duration** (minimum time assuming concurrent crafting of identical stages) vs **Sequential Duration**.
- In `/plan`:
  - Visual summary card: **"Total Foundry Time: 72 Hours (3 Days) — 3 Stages"**.
  - **Stage 1 (Queue First)**: Build 2x Bolto + 1x Dual Skana.
  - **Stage 2 (After Stage 1)**: Build Akbolto.
  - **Stage 3 (Final Blueprint)**: Build Akjagara.

---

### 12.7. Target Recipe Resource Breakdown & Foundry Ingredients

#### Problem & Context
When looking at `Bolto`, the card says *"Used to build: Akbolto (2 copies)"*. The player does not know what non-weapon resources are needed to craft Akbolto, forcing them to open another tab or leave the page.

#### UI & Data Integration
- Leverages `/materials.json` (already pre-compiled by `materials.json/route.ts`).
- In `VerdictCard.tsx`: Each target weapon row gains an expandable/hoverable **"Blueprint Requirements"** pill:
  - **Weapon Ingredients**: `2x Bolto`
  - **Foundry Resources**: `1x Orokin Cell`, `20,000 Credits`, `1x Akbolto Blueprint (Market)`
- **Rare Resource Tags**: Highlights bottleneck resources with visual pills:
  - 🟡 `1x Orokin Cell`
  - 🔵 `Forma` / `Tellurium`
  - ⚡ `Argon Crystal`
- One-click action button: `[ Plan Full Build → ]` linking directly to `/plan/?w=akbolto`.

---

### 12.8. Direct Community Links (Wiki & Market)

#### Problem & Context
When a player discovers a weapon they need to keep or farm, their immediate next question is *"Where does this drop?"* or *"What is the relic/platinum price?"*.

#### Implementation
- In `w/[slug]/page.tsx`: A discreet **Community Links** strip in the weapon header:
  - **Warframe Wiki**: `https://wiki.warframe.com/w/${encodeURIComponent(weapon.name)}` (direct drop tables, damage stats, quirks).
  - **Warframe Market**: `https://warframe.market/items/${encodeURIComponent(weapon.slug.replace(/-/g, '_'))}` (for Prime sets and syndicate weapons).
- Strict non-commercial posture preserved: External links open with `rel="noopener noreferrer"` in a new tab; no affiliate tracking, ads, or cookies.


