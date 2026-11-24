# Forgeline

*See what every weapon becomes before you sell it.*

A free, account-free website that tells a Warframe player whether the weapon they are about to sell
is an ingredient in another weapon's recipe, what it builds, how many copies that recipe needs, and
whether their own arsenal makes it safe to let go.

Built with Next.js 16 (App Router), React 19 and TypeScript, exported as a fully static site. The
weapon data and all 1,242 images are generated from [`@wfcd/items`](https://github.com/wfcd/warframe-items)
and committed, so a deploy never depends on an upstream server being awake.

## Where it stands

| | |
| --- | --- |
| Data pipeline | Working. 621 player weapons, 46 recipe ingredients, verified against a committed fixture |
| Images | Working. 256 px and 96 px WebP for every weapon, 12 MB total |
| Pages | Home, ingredient index, About, and a page per weapon. 626 pre-rendered pages |
| Search | Not built yet |
| Verdict engine | Working and tested, in `src/engine/`. Rules in [docs/verdict-rules.md](docs/verdict-rules.md) |
| Sell-check card | Not built yet. The engine is not on any page yet |
| My Arsenal, slot sweep, build planner | Not built yet, phase 2 |

See [docs/build-plan.md](docs/build-plan.md) section 11 for what comes next.

## Running it

```
npm install
npm run dev          # http://localhost:3000
npm run build        # static export into out/
npm test             # index integrity and the recipe fixture
npm run typecheck
```

Refreshing the game data (normally a monthly GitHub Action, see build plan section 8):

```
npm run data:verify    # read-only audit of the upstream package
npm run data:build     # rebuild data/index.json
npm run data:images    # fetch and convert anything new, incremental
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
