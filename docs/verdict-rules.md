# Verdict engine specification

Spec section 5.2 describes the verdicts in prose. Written as code, the prose leaves four things
undecided: what Sold means, how copies add up across several recipes, how deep the chain reasoning
goes, and what happens when two children disagree. This document closes those gaps so the engine can
be a pure function with fixtures, which is the only way to keep the promise in section 12 that there
are no wrong verdicts.

Everything here is derived from the real graph in `@wfcd/items@1.1276.51`. All examples are live data,
not invented.

---

## 1. Status model

The spec's four statuses are exactly a 2x2 of possession and mastery. Saying so removes the
ambiguity:

| Status | Holds a copy | Mastery done | Meaning |
| --- | --- | --- | --- |
| `notOwned` | no | no | Default |
| `owned` | yes | no | In the inventory, below rank 30 |
| `mastered` | yes | yes | Levelled to 30 and still held |
| `sold` | no | yes | Levelled to 30 and sold. Mastery is permanent |

```ts
const holds       = (s: Status) => s === 'owned' || s === 'mastered';
const masteryDone = (s: Status) => s === 'mastered' || s === 'sold';
```

Optional per-weapon quantity (`qty`, default 1 when `holds` is true) covers "I own 2 Boltos". Only
ingredient weapons need it.

## 2. Demand arithmetic

Three facts drive the whole calculation:

- A recipe **consumes** its weapon ingredients.
- Mastery is **permanent** and needs only transient possession, so a copy can be levelled to 30 and
  then consumed by a recipe. Mastery therefore never requires an extra copy beyond the ones a recipe
  already consumes.
- A copy the player already holds reduces what they must obtain.

```ts
masteryNeed(w)         = masteryDone(status(w)) ? 0 : 1
held(w)                = holds(status(w)) ? (qty(w) ?? 1) : 0
consumedByChildren(w)  = Σ over p in usedToBuild(w) of copies(w → p) × buildsNeeded(p)
grossNeed(w)           = max(masteryNeed(w), consumedByChildren(w))
buildsNeeded(w)        = max(0, grossNeed(w) - held(w))
```

`buildsNeeded` is recursive through `consumedByChildren`. Memoise per evaluation and guard against
cycles: the current data has none and a maximum depth of 3, but a future recipe should degrade to a
warning, never a stack overflow.

Why `max` rather than `+` in `grossNeed`: a player who must feed 3 Boltos into recipes needs 3, not 4,
because one of those 3 can be levelled before it is consumed.

### Worked example, nothing owned

The deepest chain in the game: Lato to Bolto to Akbolto to Akjagara, with Bolto also feeding Hystrix.

| Weapon | consumedByChildren | masteryNeed | grossNeed | held | buildsNeeded |
| --- | --- | --- | --- | --- | --- |
| Akjagara | 0 | 1 | 1 | 0 | 1 |
| Akbolto | 1 x 1 = 1 | 1 | 1 | 0 | 1 |
| Hystrix | 0 | 1 | 1 | 0 | 1 |
| Bolto | (2 x 1) + (1 x 1) = 3 | 1 | 3 | 0 | 3 |
| Lato | 1 x 3 = 3 | 1 | 3 | 0 | 3 |

So Bolto's card reads **Keep 3**: two for Akbolto, one for Hystrix. The spec's "highest number any
single recipe needs" would have said 2, which is not enough to finish both.

### Worked example, the chain case

Akbolto `mastered` (held), Akjagara `notOwned`, Hystrix `mastered`:

- `buildsNeeded(Akjagara)` = 1
- `consumedByChildren(Akbolto)` = 1, `masteryNeed` = 0, `grossNeed` = 1, `held` = 1, so
  `buildsNeeded(Akbolto)` = **0**. The Akbolto in the inventory is the one that goes into Akjagara.
- `consumedByChildren(Bolto)` = (2 x 0) + (1 x 0) = **0**, so Bolto is safe to sell.

Change Akbolto to `sold` (mastered, not held) and it flips: `held` = 0, `buildsNeeded(Akbolto)` = 1,
so `consumedByChildren(Bolto)` = 2 and the card reads **Keep 2 for Akbolto, which Akjagara needs**.
That is the case the spec illustrates with the four-weapon chain, and the arithmetic is what makes
the reason text truthful.

## 3. Verdict decision order

Evaluate in this order and stop at the first match.

| # | Condition | Verdict | Card says |
| --- | --- | --- | --- |
| 1 | `usedToBuild(w)` is empty | **Safe to sell** | "This weapon isn't used in any recipe." Plus the mastery note from section 4 if relevant |
| 2 | The arsenal is not set up: no weapon has a status other than `notOwned` | **Check** | Lists what it builds with copy counts, and invites the player to mark those weapons. Inline status buttons on the card, so the answer resolves without leaving the page |
| 3 | `consumedByChildren(w) == 0` and every target has `masteryDone` | **Safe to sell** | "Everything this builds is already mastered." |
| 4 | `consumedByChildren(w) == 0` and some target is held but unmastered | **Safe to sell (soft)** | "You already own Akbolto. Level it before selling that." |
| 5a | `consumedByChildren(w) > 0` and the player holds more than that | **Safe to sell the surplus** | "You need 3 and have 5, so 2 are spare." Only reachable when quantities are tracked |
| 5b | `consumedByChildren(w) > 0` otherwise | **Keep N**, N = `consumedByChildren(w)` | One line per target with its subtotal and reason, plus the forward chain when the reason is transitive |

Rule 2 is defined by values rather than by "anything stored", so the engine gives the same answer
whether or not the store keeps explicit `notOwned` entries. Every status in a 2 x 2 cell either
equals the default or records progress.

Each target line carries one of four reasons, which is what the card's wording hangs off:

| Reason | When | Line reads |
| --- | --- | --- |
| `needs-building` | Target is `notOwned`, so it must be built at least once | "2 for Akbolto, on the way to Akjagara." |
| `feeds-chain` | Target's own mastery is covered, but something below it still consumes copies | "2 for Akbolto, which Akjagara still needs." |
| `mastered` | Target is mastered or sold and nothing below it is outstanding | "Hystrix is already mastered." |
| `held-unmastered` | Target is held and unlevelled, and nothing needs another copy | "You already own Akbolto. Level it before selling that." |

A useful consequence of the arithmetic, and the property the random-walk test enforces: for any one
weapon, `buildsNeeded` is ordered **notOwned >= sold >= owned = mastered**. Recording progress can
therefore never make any verdict stricter, and a Safe can never turn back into a Keep because the
player marked something.

Rules that apply to every verdict:

- **Keep beats Safe**, and the card lists every reason rather than the first one found. A weapon
  feeding three recipes shows three lines.
- **Unset statuses count as `notOwned`** once the arsenal exists. That can only produce an
  unnecessary Keep, never a wrong Safe. Mark such rows "assumed not owned" and offer a one-tap fix.
- **Every verdict carries its reason.** A verdict without a reason is easy to ignore, and impossible
  to debug when a player reports it as wrong.
- **Quantities, when tracked:** show "Keep 3, you have 1" and let the headline number stay the total
  requirement. `buildsNeeded` is the "still to get" figure and belongs in the build planner.

## 4. The mastery note, which the spec omits

Independent of the recipe verdict, attach a note when `!masteryDone(w)`:

- `owned` (held, unmastered): "You haven't mastered Bolto yet. Levelling it to rank 30 is worth 3,000
  mastery, and that stays after you sell it."
- `notOwned` or unrecorded: a conditional note, "If Bolto isn't rank 30 yet, level it before you sell
  it: that's 3,000 mastery, and it stays after you sell." The player is asking about selling it, so
  they hold one, whatever the arsenal says. What we cannot know is whether it is levelled.
- `mastered` or `sold`: no note.

The numbers come from the data, not a constant. Weapons give 100 mastery per rank, and 52 of them
(Kuva, Tenet, Coda, Paracesis and a few others) level to 40 rather than 30, so the build reads
`maxLevelCap` into the index as `maxRank` and the note quotes 3,000 or 4,000 accordingly.

This is the most common real mistake a mastery grinder makes, and it applies to all 621 weapons on
the site, not just the 46 ingredients.

## 5. Edge cases the engine must handle

| Case | Rule |
| --- | --- |
| A weapon that is both ingredient and target | Normal. Five exist today: Akbolto, Bolto, Dual Kamas, Mutalist Cernos, Tipedo |
| Prime and non-Prime | Separate weapons, separate graphs, never merged. Lex feeds Aklex, Lex Prime feeds Aklex Prime |
| Weapon with no recipe at all, such as a Kuva or Tenet weapon | Verdict 1 applies. No recipe and no children means safe, with the mastery note |
| Non-weapon components in a recipe (blueprints, Orokin Cells) | Ignored by the graph. Listed as information on the weapon page, never tracked |
| Modular parts and non-masterable entries | Excluded from the index entirely, so they never reach a verdict |
| `qty` greater than what is needed | Safe to sell the surplus: "you need 2, you have 3" |
| A future recipe cycle | Graph construction drops the edge that closes the loop (and its mirror), records a warning, and every later walk runs over a guaranteed DAG. Better than a guard inside the arithmetic, which would memoise partial results in an order-dependent way |

## 6. Test fixtures

These are the engine's unit tests, in [tests/engine.test.ts](../tests/engine.test.ts). Every row uses
the real graph. Statuses not listed are `notOwned`.

Rows that say "nothing owned" also mark **Braton** as `mastered`. Braton builds nothing and is built
from nothing, so it sets the arsenal up (rule 2) without touching any recipe in the table. Without
it, an arsenal of nothing but defaults is a Check, not a Keep: an ambiguity in the first draft of this
table that the tests caught.

| # | Weapon | Arsenal state | Expected verdict | Expected number and reason |
| --- | --- | --- | --- | --- |
| 1 | Braton | empty arsenal | Safe to sell | Not an ingredient |
| 2 | Bolto | empty arsenal | Check | Builds Akbolto (2) and Hystrix (1) |
| 3 | Bolto | nothing owned | Keep | 3: two for Akbolto, one for Hystrix |
| 4 | Bolto | Akbolto `mastered`, Hystrix `mastered` | Safe to sell | Everything it builds is mastered |
| 5 | Bolto | Akbolto `owned`, Hystrix `mastered`, Akjagara `notOwned` | Safe to sell (soft) | Own Akbolto, level it first |
| 6 | Bolto | Akbolto `sold`, Hystrix `mastered`, Akjagara `notOwned` | Keep | 2 for Akbolto, needed again for Akjagara |
| 7 | Lato | nothing owned | Keep | 3, through Bolto |
| 8 | Lato | Bolto `mastered`, Akbolto `mastered`, Hystrix `mastered`, Akjagara `mastered` | Safe to sell | Whole chain complete |
| 9 | Dual Skana | Akjagara `mastered`, Dark Split-Sword `notOwned`, Redeemer `sold` | Keep | 1, for Dark Split-Sword. Three lines listed, two satisfied. (The first draft said 2, "one to rebuild Redeemer", which contradicts section 2: Redeemer is sold, so its mastery is done, and it builds nothing, so nothing needs it rebuilt) |
| 10 | Viper | Hystrix `notOwned`, Twin Vipers `mastered` | Keep | 1 for Hystrix |
| 11 | Lex Prime | Aklex `mastered`, Aklex Prime `notOwned` | Keep | 2 for Aklex Prime. Proves Prime separation: the non-Prime status must not satisfy it |
| 12 | Mutalist Cernos | Proboscis Cernos `notOwned`, status `owned` qty 1 | Keep | 1 for Proboscis Cernos, "you have 1" |
| 13 | Cernos | nothing owned | Keep | 1, chain shown: Cernos, Mutalist Cernos, Proboscis Cernos |
| 14 | Any weapon | arsenal with one unrelated status set | Not Check | Unset targets count as `notOwned`, so the verdict resolves rather than falling back to Check |

Property tests run the rules over all 46 ingredients at once, which is what catches graph-shape
regressions after a monthly refresh:

- **Empty arsenal:** every ingredient is Check and every other weapon is Safe.
- **Everything mastered:** every ingredient is Safe.
- **Nothing owned:** every ingredient is Keep with `N >= 1`, and N agrees three ways: the verdict,
  `consumedByChildren`, and the sum of the target lines.
- **Progress never makes a verdict stricter:** a seeded random walk over the 87 verdict-relevant
  weapons (300 rounds) moves one weapon one step up `notOwned, sold, owned, mastered` and checks that
  no ingredient's N rises and no Safe becomes a Keep.

The first draft proposed "with every *direct* target mastered, every ingredient is Safe". That is
false, and correctly so: with Bolto mastered (one copy held) but Akbolto and Hystrix not owned, those
two still consume three Boltos, so Lato is Keep 2. Direct targets are not the whole story whenever a
target is itself an ingredient.

Each of these was checked against a deliberately broken engine. Replacing the sum over recipes with
the spec's original "highest single recipe" fails 8 tests, letting mastery add a copy fails 11, and
ignoring held copies fails 5 including the random walk.
