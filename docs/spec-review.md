# Spec review: Forgeline 1.1

Reviewed 24 November 2026 against the live data source, not from reading alone. I installed
`@wfcd/items@1.1276.51`, re-implemented the Section 6 index build, scanned all 26 data files, and
measured the image pipeline end to end. The reproduction script is
[verify-source-data.mjs](../scripts/verify-source-data.mjs).

**Overall: the spec is sound and unusually well grounded.** Every headline number in it checks out.
The work below is mostly four things: fields that are shaped differently from the spec's examples,
verdict rules that turn ambiguous the moment you write them as code, a weapon list that needs
filtering before a player sees it, and automation details that decide whether a monthly refresh can
publish bad data.

---

## 1. What I verified against the live data

| Spec claim | Result |
| --- | --- |
| `@wfcd/items` 1.1276.51, MIT, updated 14 November 2026 | Correct. The registry reports exactly that version, modified 2026-11-14 |
| 668 weapons across Primary, Secondary, Melee, Arch-Gun, Arch-Melee, SentinelWeapons | Correct. 197 + 149 + 270 + 20 + 8 + 24 = 668 |
| All 668 have a picture | Correct. Zero entries are missing `imageName` |
| 46 ingredient weapons | Correct. My rebuild derived exactly the 46 in Appendix A: no extras, none missing |
| Appendix A copy counts | Correct on every row sampled, including Bolto (Akbolto 2, Hystrix 1) and the Prime pairs |
| Akbolto lists Bolto twice rather than once with a count of 2 | Correct, and it is not alone. Afuris, Twin Krohkur, Dual Kamas and every other 2-copy recipe list the ingredient twice at `itemCount: 1`. Summing is mandatory |
| Akstiletto feeds Sarpa (flagged as unusual, verify) | Present in the data: `Sarpa <- Akstiletto x1` |
| Chain example Lato, Bolto, Akbolto, Akjagara | Correct, and it is the deepest chain in the game data |
| Pictures come from `cdn.warframestat.us/img/` | Works, but see correction 5: it is a redirect to GitHub raw |

Two useful measurements the spec does not have:

- **Chain depth is tiny.** Maximum forward depth is 3 (Lato). 40 of the 46 ingredients are depth 1,
  five are depth 2, one is depth 3. The full-depth family tree deferred to phase 2 costs almost
  nothing, and needs no lazy loading, pagination or graph library.
- **Image budget, measured on 8 real weapons.** Sources are 512x512 PNG with alpha, averaging 34 KB.
  Converted: 256 px WebP averages 12 KB, 96 px averages 3 KB. The full set is about **9 MB** of
  generated assets from about **21 MB** downloaded on a cold rebuild.
- **Payload, measured on the real data contract.** The whole index, 622 player weapons with both
  directions of the recipe graph, is 153 KB raw and **16.5 KB gzipped** (13 KB brotli), or 11 KB
  gzipped if image paths are derived from the slug at runtime. There is no reason to split, paginate
  or lazy load anything.

## 2. Corrections the spec needs

1. **Components carry no name.** A component is only `{ uniqueName, itemCount }`. The Section 6
   example record showing `"name": "Akbolto"` is the output shape, not the input. Ingredient
   resolution must go through a `uniqueName` index built from the weapon files first.
2. **`uniqueName` is not derivable from the display name.** Bolto is
   `/Lotus/Weapons/Tenno/Pistol/CrossBow`, Lato is `/Lotus/Weapons/Tenno/Pistol/Pistol`. Matching
   ingredients by path text will silently miss recipes.
3. **`introduced` is an object, not a string.** It is
   `{ name: "Update 6.0", url, aliases, parent, date }`. The spec's record shows
   `"introduced": "Vanilla"`, so the pipeline reads `introduced.name`, and `introduced.date` is a
   better signal for the New badge than diffing update names.
4. **`imageName` is not derivable from the display name either.** Dual Skana is `DualSkanas.png`,
   Broken War is `BrokenWar.png`, Dark Split-Sword is `DarkSplitSwordHybrid.png`. Keep the slug for
   the **output** path, but the **source** filename must come from `imageName`. Also, 623 distinct
   `imageName` values cover 634 masterable weapons, so 11 weapons share art: dedupe downloads by
   source name, key output files by weapon slug.
5. **The image CDN is a redirect to GitHub.** `cdn.warframestat.us/img/Bolto.png` returns 301 to
   `raw.githubusercontent.com/wfcd/warframe-items/master/data/img/Bolto.png`. The fetcher must follow
   redirects, and the real dependency is GitHub raw with unauthenticated rate limits. The images are
   **not** in the npm package (the 94 MB is JSON and translations), so downloading is unavoidable.
   Fetch with modest concurrency (6 to 8), retry with backoff, skip anything already in the manifest.
6. **"46 ingredient weapons" will not stay 46.** It is right today, so make it a number the build
   computes and the page renders, never a literal in copy. Section 1, 5.7 and Appendix A all hard-code
   it.
7. **The Warframes and companions caution overstates the v1 risk.** I scanned every component
   reference in all 26 data files recursively (6,041 references) looking for anything outside the six
   weapon files that consumes a weapon: **zero hits**. No Warframe, companion, Archwing or component
   recipe takes a weapon as an ingredient. So v1 cannot produce a wrong "safe to sell" because of an
   out-of-scope ingredient type: the weapon graph is closed. Phase 3's non-weapon work is a new
   feature (the same question for frame and companion parts), not a correctness hole in v1.
8. **Slot filters must use `productCategory`, not `category`.** `category` files the 24 sentinel
   weapons under Primary, which breaks the companion-weapon filter in 5.4. `productCategory` gives
   the buckets the spec wants: LongGuns 196, Pistols 194, Melee 225, SpaceGuns 20, SpaceMelee 8,
   SentinelWeapons 24. There is also a single `OperatorAmps` entry sitting in the weapon files that
   needs a decision (exclude in v1).

## 3. Gaps: decisions the spec leaves to the implementation

### Product logic

1. **"Keep at least" is underspecified, and the stated rule is arguably wrong.** The spec defines it
   as the highest count any single unbuilt recipe needs. For Bolto with both recipes outstanding that
   gives 2, but building both Akbolto and Hystrix consumes **3** Boltos. Max answers "what is the
   biggest single ask", sum answers "what do I still need in total". Recommend the sum of outstanding
   immediate demand with the per-recipe split underneath. Worked through in
   [verdict-rules.md](verdict-rules.md).
2. **Transitive demand is illustrated, never defined.** The chain row in 5.2 shows
   "Lato to Bolto to Akbolto to Akjagara" without the arithmetic. Computed properly, a player who owns
   none of that chain needs 7 Latos. True, and unhelpful in a sell check, since Lato is
   market-buyable. The verdict should use **immediate** outstanding demand and show the chain for
   context. Full transitive totals belong in the build planner, which has an explicit target.
3. **Sold is missing from the verdict rules.** 5.4 defines four statuses, 5.2 and 5.3 use three. The
   clean model is a 2x2 of possession and mastery: Not owned (neither), Owned (hold, not mastered),
   Mastered (hold and mastered), Sold (mastered, not held). Mastery is permanent, so Sold behaves
   like Mastered for verdicts and like Not owned for possession.
4. **No copy counts in the arsenal.** One status per weapon cannot express "I own 2 Boltos", which is
   exactly what makes "keep 3" actionable. Recommend an optional quantity on ingredient weapons only,
   defaulting to 1.
5. **Nothing covers the most common real mistake.** A mastery grinder's worst sell is a weapon they
   have not mastered yet, ingredient or not. The rules only talk about recipes. Add a mastery line to
   every card: "you have not mastered this yet" is worth saying even when the verdict is Safe.
6. **Verdict precedence across several children is unstated.** Define it once: Keep beats Safe, and
   the card lists every reason rather than the first one found.
7. **Arsenal setup is framed as 668 weapons when only 87 matter.** Verdicts depend on the 46
   ingredients plus the 46 things they build, which overlap by 5: an 87-weapon set. A guided first-run
   flow over those 87, or even just the 46 targets, converts Check into Keep or Safe in a couple of
   minutes. The full 668-weapon checklist is a mastery tracker: a different, lower-priority job.
8. **Non-player entries need filtering before anyone sees a checklist.** 34 of the 668 are
   `masterable: false` Zaw and Kitgun parts (`type: "Zaw Component"`), filed under Pistols even when
   they are melee. Nine display names are duplicated, all Conclave variants of modular parts, except
   **Grimoire**, which has two masterable entries (`TnGrimoire` and `TnDoppelgangerGrimoire`). So:
   drop non-masterable entries, drop modular parts, drop the stray Amp, and keep a small
   hand-maintained exclusion list for cases like the Doppelganger Grimoire. That is 46 entries
   removed, leaving **622** weapons, of which 556 have a recipe.
9. **Slug collisions are real.** Nine names collide in the raw data, and one survives the filtering
   above (Grimoire). `/w/bolto` style routes need a deterministic slug, a documented tiebreak, and a
   slug-history file so a renamed weapon's old URL keeps working.

### Data and automation

10. **There is no publish gate.** "If the build fails, keep last month's data" covers crashes, not
    bad data. A format change that half-resolves is worse than a crash: it would quietly drop
    ingredients and turn Keep into Safe to sell. Gate the deploy on schema validation plus sanity
    diffs (ingredient count moved more than 20 percent, any weapon lost its image, any previously
    known ingredient disappeared) and on a committed fixture of wiki-verified rows.
11. **The wiki check in Section 6 is a one-off chore with no artifact.** Make it a checked-in fixture
    that a test asserts against every month, so "no wrong verdicts" is enforced rather than
    remembered.
12. **PWA caching versus monthly data is unaddressed.** A service worker that precaches will serve
    last month's index indefinitely. Content-hash the data file and prompt "data updated, reload" when
    the worker finds a new build.
13. **GitHub Actions cron is best-effort.** Scheduled runs can be delayed on shared runners, and
    schedules are disabled automatically in a repository with no activity for 60 days. Neither is
    fatal monthly, but the manual trigger matters more than the spec implies, and the footer should
    print the real last-refresh timestamp from the build rather than a promise.
14. **No measurement plan for the success metrics.** "An answer in under five seconds" and "players
    come back" need either a cookieless analytics endpoint (one that fits the no-accounts,
    non-commercial posture) or an honest downgrade to qualitative feedback.
15. **Storage needs a schema version from day one.** localStorage and the export file both need a
    version and a migration path, or the phase 2 shape change silently loses arsenals.

### Presentation and compliance

16. **Red for Keep is a risky mapping.** Red reads as error, and Keep is the protective outcome.
    Whichever way it lands, never carry the verdict in colour alone: pair each with an icon and the
    word, which also handles contrast and colourblind needs on the dark theme.
17. **Thumbnails at "about 48 px" need 96 px assets** for 2x screens, which is why the thumbnail tier
    measures 3 KB rather than 1 KB.
18. **Re-hosting DE art is the right call and worth stating plainly.** The Content Policy's
    non-commercial clause is what covers it, which makes "stays free, no paywall, no ads" a hard
    product constraint rather than a preference. The About page should say where the art comes from.

## 4. Risks, in the order worth worrying about

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Upstream data shape changes | Everything is derived from it, and a silent half-break produces wrong verdicts, which is worse than no site | Schema validation, sanity diffs, verified fixture, publish gate, keep last good build |
| A wrong Safe to sell | One wrong answer costs a player hours of farming and all of the site's credibility | Pure, unit-tested verdict engine, fixtures from Appendix A, every verdict states its reason |
| GitHub raw availability or rate limits during the image fetch | Build fails or produces half an image set | Manifest-driven incremental fetch, retries with backoff, never delete existing assets on failure, backup source `warframe-public-export-plus` |
| Repository growth from committed WebP | 9.8 MB now plus monthly diffs | Fine for years. If it stops being fine, move assets to a separate branch or an R2 bucket. Both reversible |
| Scope creep into the 668-weapon mastery tracker | It is the most visible feature and the least valuable one | Ship the 87-weapon verdict-relevant flow first, full tracker after |
| Trademark and asset compliance | A fan tool exists on sufferance | No DE logos, no ads, no paywall, footer disclaimer, credit WFCD, re-read the policy before launch |

## 5. Open decisions

The spec's four, with a recommendation each, plus three worth adding.

| # | Decision | Recommendation |
| --- | --- | --- |
| 1 | Domain and hosting account | **Hosting decided:** files stay on GitHub, and Vercel serves the site from the repository at https://forgeline-arsenal.vercel.app (build plan section 9). The first recommendation here was Cloudflare Pages; either works for a static export. **Domain still open:** `forgeline.app` if available. It is the one irreversible part, so register before the About copy is written |
| 2 | Space Heroes branding | One "Built by the Space Heroes clan" line in the footer. It costs nothing, it is honest, and the header stays neutral |
| 3 | Warframes and companions in phase 1 or 2 | Neither. The data proves no weapon recipe needs them, so they add no verdict accuracy. Keep them in phase 3 as a separate answer for frame and companion parts |
| 4 | Who receives the failure alert | Better: no email secret at all. Have the workflow open a GitHub issue on failure. That notifies watchers for free and leaves an audit trail. Add email later if it is ever missed |
| 5 | Max or sum for "keep at least" | Sum of outstanding immediate demand, with the per-recipe breakdown shown |
| 6 | Commit generated images, or build them on deploy | Commit them. Deterministic deploys, working offline precache, survives a CDN outage, small monthly diff |
| 7 | Any analytics at all | Something cookieless (with the site on Vercel, its own Web Analytics is the natural candidate), or drop the time-to-answer metric honestly |
