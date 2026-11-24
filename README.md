# Forgeline

*See what every weapon becomes before you sell it.*

A free, account-free website that tells a Warframe player whether the weapon they are about to sell
is an ingredient in another weapon's recipe, what it builds, how many copies that recipe needs, and
whether their own arsenal makes it safe to let go.

Nothing is built yet. This repository currently holds the product spec and the plan derived from it.

| File | What it is |
| --- | --- |
| [Forgeline_Website_Spec.md](Forgeline_Website_Spec.md) | The product spec, version 1.1 |
| [docs/spec-review.md](docs/spec-review.md) | Review of that spec against the live data source: what checks out, what needs correcting, what it leaves undecided |
| [docs/verdict-rules.md](docs/verdict-rules.md) | The verdict engine written unambiguously, with the demand arithmetic and test fixtures |
| [docs/build-plan.md](docs/build-plan.md) | Architecture, data contract, pipeline, milestones and quality gates |
| [scripts/verify-source-data.mjs](scripts/verify-source-data.mjs) | Read-only audit of the upstream weapon data. Reproduces the ingredient graph and checks it against the fixture |
| [data/fixtures/verified-recipes.json](data/fixtures/verified-recipes.json) | Snapshot of the 46 ingredient weapons and their copy counts, used as the publish gate |

To run the audit:

```
npm i @wfcd/items
node scripts/verify-source-data.mjs
```

Data comes from [`@wfcd/items`](https://github.com/wfcd/warframe-items) (MIT) by the Warframe
Community Developers. Forgeline is a fan-made tool, not affiliated with or endorsed by Digital
Extremes. Warframe is a trademark of Digital Extremes Ltd.
