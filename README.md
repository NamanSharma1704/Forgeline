# Forgeline

*See what every weapon becomes before you sell it.*

A free, account-free website that tells a Warframe player whether the weapon they are about to sell
is an ingredient in another weapon's recipe, what it builds, how many copies that recipe needs, and
whether their own arsenal makes it safe to let go.

Built with Next.js 16 (App Router), React 19 and TypeScript, exported as a fully static site. The
weapon data and all 1,242 images are generated from [`@wfcd/items`](https://github.com/wfcd/warframe-items)
and committed, so a deploy never depends on an upstream server being awake.

**Live at https://forgeline-arsenal.vercel.app.** This GitHub repository holds every file; Vercel
reads it and redeploys on each push to `main`, so nothing lives only on Vercel.

## Where it stands

| | |
| --- | --- |
| Data pipeline | Working. 621 player weapons, 46 recipe ingredients, verified against a committed fixture |
| Images | Working. 256 px and 96 px WebP for every weapon, 12 MB total |
| Pages | Home, My Arsenal, sweep, planner, ingredient index, About, and a page per weapon. 636 pre-rendered files |
| Search | Working. Typo tolerant, Prime aware, `/` from any page |
| Verdict engine | Working and tested, in `src/engine/`. Rules in [docs/verdict-rules.md](docs/verdict-rules.md) |
| Sell-check card | Working on every weapon page, and personal once you mark your arsenal: Keep N or Safe, with the reason |
| My Arsenal and slot sweep | Working. Saved in the browser, with file export and import |
| Build planner | Working. Every weapon down the chain, what is left to build, and the resources it costs |
| Family tree | Full depth on every weapon page, with the recipe underneath |
| Install and offline | Installable, and one visit saves the recipe weapons, arsenal, sweep and planner for offline use. A new build asks before it reloads |

See [docs/build-plan.md](docs/build-plan.md) section 11 for what comes next.

## Running it

```
npm install
npm run dev          # http://localhost:3000
npm run build        # static export into out/
npm test             # index integrity and the recipe fixture
npm run typecheck
```

### The monthly data refresh

`.github/workflows/refresh-data.yml` runs at 06:00 UTC on the 1st of each month. It rebuilds the
weapon data from the latest `@wfcd/items`, rechecks every picture, and publishes only if the publish
gate, the tests and the build all pass. Publishing is a push to `main`, which Vercel deploys. A quiet
month changes nothing and deploys nothing.

Anything that changes the recipe graph (a weapon gaining or losing an ingredient role, a copy count)
is **blocked until a person checks it**, because that is what decides Keep and Safe. When that
happens, an issue labelled `data-refresh` lists the changes. Check them against the WARFRAME Wiki,
then open **Actions > Monthly data refresh > Run workflow** and tick **accept recipe changes**. Changes
that look like a broken source (a big swing in the ingredient count, many weapons vanishing) cannot
be accepted; the live site simply keeps last month's data.

The same steps by hand:

```
npm run data:verify    # read-only audit of the upstream package
npm run data:refresh   # build a candidate index beside the live one and run the publish gate
npm run data:images    # fetch and convert anything new; add -- --recheck to compare every picture
npm run data:accept    # after reviewing a recipe change: update the verified-recipe fixture
```

## Documents

| File | What it is |
| --- | --- |
| [Forgeline_Website_Spec.md](Forgeline_Website_Spec.md) | The product spec, version 1.1 |
| [docs/spec-review.md](docs/spec-review.md) | Review of that spec against the live data source: what checks out, what needs correcting, what it leaves undecided |
| [docs/verdict-rules.md](docs/verdict-rules.md) | The verdict engine written unambiguously, with the demand arithmetic and 14 test fixtures |
| [docs/build-plan.md](docs/build-plan.md) | Architecture, data contract, pipeline, milestones and quality gates |

## Credits and legal

Weapon data and art come from [`@wfcd/items`](https://github.com/wfcd/warframe-items) (MIT) by the
Warframe Community Developers. Forgeline is a fan-made tool, is free, carries no adverts, and is not
affiliated with or endorsed by Digital Extremes. Warframe is a trademark of Digital Extremes Ltd.
Weapon pictures are Digital Extremes' game assets, used under the non-commercial terms of the
Warframe Content Policy.
