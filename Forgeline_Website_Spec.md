# Forgeline

*See what every weapon becomes before you sell it.*

Forgeline is a free website for Warframe players. You type in a weapon you are about to sell, and it tells you what that weapon is used to build, how many copies the recipe needs, and whether you should keep it. Every weapon is shown with its in-game picture, and the weapon list refreshes itself once a month so new weapons appear without anyone typing them in. It also lets you track your arsenal so the answer is personal to you.

Product spec, version 1.1. Prepared 24 November 2026. Changes in 1.1: monthly data refresh and weapon pictures throughout the site.

---

## 1. The problem

Warframe currently has 46 weapons that are ingredients in other weapons' recipes (counted from the game data in Section 6). The game gives no warning when you sell one. Players usually find out weeks later, when a blueprint asks for two Boltos and they sold theirs to free up a slot.

The tools players use today each stop short:

| Tool | What it does | Where it falls short |
| --- | --- | --- |
| In-game Foundry | Shows the components of blueprints you already own | Says nothing about blueprints you don't own yet, and works in one direction only |
| AlecaFrame | Has a "Used for Crafting" filter | Tells you a weapon is an ingredient, but not what it builds |
| WARFRAME Wiki | Has a list of ingredient weapons | You have to leave the game and search a long page |
| Guide sites (Gamepur and similar) | Ingredient to result tables | Undated, so new weapons may be missing |

Nobody answers the actual question in one step: "Can I sell this, and if not, why?"

## 2. What Forgeline is

A mobile-friendly website with four jobs:

1. Answer "can I sell this?" in a few seconds, with a clear verdict.
2. Show the full crafting family of any weapon, forwards and backwards.
3. Let players track what they own and have mastered, so the verdict reflects their own arsenal.
4. Show every weapon with its in-game picture, so players recognise it at a glance even when they can't remember the name.

## 3. Goals and non-goals

### Goals

- Answer a sell question in under five seconds from opening the site.
- Work with no account and no login.
- Refresh the weapon list, recipes and pictures automatically once a month, so new weapons appear without manual data entry.
- Work well on a phone, since most players will check while the game is open on their PC.
- Be easy to share with a clan.

### Non-goals (version 1)

- No AlecaFrame integration of any kind.
- No reading of game files, game memory or the player's Warframe account. Everything the site knows about a player's arsenal is entered by the player.
- No trading, platinum prices or market data.
- No user accounts or server-side storage in the first two phases.

## 4. Who it is for

| Player | What they need |
| --- | --- |
| New players | They run out of weapon slots early and sell things to make room. They need a safe-to-sell answer before they hit the button. |
| Mastery grinders | They level every weapon once and sell it. They need to know which weapons must be kept or rebuilt for a later recipe. |
| Clan members | They want one shared tool, and want to know who has spare ingredient weapons. |

## 5. Features

### 5.1 Sell Check (the core feature)

The home page is a single search box.

Search behaviour:

- Matches as you type, and tolerates typos ("bolot" finds Bolto).
- Each suggestion in the drop-down shows a small picture of the weapon beside its name.
- Treats Prime and non-Prime versions as different weapons, because they feed different recipes (Lex builds Aklex; Lex Prime builds Aklex Prime).
- Pressing `/` anywhere on the site jumps to the search box.

The result card shows:

- The weapon's picture and name at the top.
- A verdict banner: Keep, Safe to sell, or Check (rules in 5.2).
- "Used to build", listing each weapon it goes into (with its picture) and how many copies that recipe needs. Example: Bolto is used to build Akbolto (2 copies) and Hystrix (1 copy).
- "Keep at least", the highest number of copies any single unbuilt recipe needs.
- The next step in the chain, if the weapon it builds is itself an ingredient. Example: Bolto builds Akbolto, and Akbolto is used in Akjagara.
- A "Copy result" button for pasting into clan chat.

### 5.2 Verdict rules

The verdict depends on whether the player has filled in their arsenal (5.4).

| Situation | Verdict | What the card says |
| --- | --- | --- |
| The weapon builds nothing | Safe to sell | "This weapon isn't used in any recipe." |
| It builds something, and the player has not set up their arsenal | Check | Lists what it builds and asks the player to mark those weapons |
| It builds something, and every weapon it feeds is marked Mastered | Safe to sell | "Everything this builds is already mastered." |
| It builds at least one weapon the player has not mastered, and they don't own that weapon yet | Keep | "Keep N for Akbolto." (N is the copy count) |
| The weapon it builds is owned but not mastered | Safe to sell (soft) | "You already own Akbolto. Level it before selling that." |
| The chain continues (it builds a weapon that is itself an ingredient for something unmastered) | Keep | Shows the full chain, for example "Lato → Bolto → Akbolto → Akjagara" |

The rules always explain themselves. A verdict without a reason is easy to ignore.

### 5.3 Weapon family tree

Every weapon has its own page with a small diagram:

- Backwards: what it is made from, including other weapons.
- Forwards: what it is used to build, down to the end of the chain.

Example chain from the current data: Lato builds Bolto, Bolto (2 copies) builds Akbolto, and Akbolto plus Dual Skana builds Akjagara.

Each box in the tree shows the weapon's picture, its name and copy count, and the player's own status (Not owned, Owned, Mastered) once the arsenal is filled in. Tapping a box opens that weapon's page.

### 5.4 My Arsenal checklist

A simple list of every weapon where the player marks one status per weapon:

| Status | Meaning |
| --- | --- |
| Not owned | Default |
| Owned | In the inventory, not yet rank 30 |
| Mastered | Levelled to 30 at least once (it counts for mastery even if sold later) |
| Sold | Mastered and sold |

Details:

- A small picture beside every weapon, plus an optional grid view that shows the arsenal as picture tiles.
- Saved in the browser, so it works without an account.
- Filters for slot (primary, secondary, melee, arch-gun, arch-melee, companion weapon), status, and "ingredients only".
- A progress bar showing how many weapons are mastered.
- Export and import as a small file, so the list can move to another device or survive clearing the browser.
- A one-tap "mark the starter weapons I got in the tutorial" shortcut to save time for new players.

### 5.5 Slot clearing sweep

For the moment every new player hits: "I'm out of slots, what can I get rid of?"

The page takes every weapon marked Owned and sorts it into two lists:

- Safe to sell: mastered, and not needed for anything unbuilt.
- Keep: with a one-line reason for each.

### 5.6 Build planner

The player picks a weapon they want, such as Akjagara. The planner then lists:

- Every weapon needed down the whole chain, with copy counts.
- Which of those the player already owns.
- A short "still to get" list they can work through.

The planner only covers weapon ingredients. Resources such as Orokin Cells are listed but not tracked.

### 5.7 Ingredient index

A browsable page listing all 46 ingredient weapons, with slot, what each builds and the copy counts. Sortable and filterable, with a toggle for "only ones I own". Appendix A shows the current list.

### 5.8 Clan sharing (phase 3)

- A read-only share link of a player's arsenal.
- A clan page where members can see who has spare ingredient weapons, so nobody farms a Bolto that a clanmate could have built for them.
- This is the only feature that would need a small server, so it waits until the core is proven.

### 5.9 Staying current

- The weapon list, recipes and pictures refresh automatically once a month (details in Section 6).
- The footer shows which game update the data matches (the current package tracks Update 44.1.4), when it was last refreshed, and when the next refresh is due.
- Weapons added since the previous monthly refresh get a "New" badge until the next one. A "New this month" strip on the home page shows them with their pictures.
- Every weapon page shows which game update added it (for example, Akbolto: Update 6.0), taken from the data.
- An "About the data" page explains where the data comes from and how to report a mistake.

### 5.10 Comfort features

- Dark theme by default, with a light option.
- Installable on a phone home screen and usable offline (Progressive Web App).
- Text sizes and contrast that stay readable on small screens.

### 5.11 Weapon pictures

Every weapon on the site appears with its in-game picture. In the current data, all 668 weapons have one.

Where pictures appear:

| Place | Picture size |
| --- | --- |
| Search suggestions | Small thumbnail (about 48 px) |
| Sell Check result card | Large (about 256 px) |
| Weapon page header | Large (about 256 px) |
| Family tree boxes | Medium (about 96 px) |
| Ingredient index, My Arsenal, slot sweep, build planner | Small thumbnail, with an optional picture-grid view |
| "New this month" strip | Medium |

How they behave:

- Pictures are copied onto Forgeline's own hosting during each monthly refresh, not loaded from someone else's server while the player browses. This keeps the site fast and means it keeps working if an outside image server goes down.
- Each picture is saved as a compressed WebP file in two sizes (thumbnail and large), so pages stay light on mobile data.
- Pictures load only when they scroll into view.
- If a picture is missing or fails to load, a plain silhouette for that slot type (pistol, rifle, melee and so on) is shown instead, so the layout never breaks.
- Every picture has the weapon's name as its alt text, for screen readers.
- Pictures are shown on a transparent or dark tile so they sit well in both dark and light themes.

## 6. Data

### Source

The recipe data comes from `@wfcd/items`, an open-source package maintained by the Warframe Community Developers (MIT licence, built from Digital Extremes' public game data export). The version checked for this spec is 1.1276.51, updated 14 November 2026.

Backup source: `warframe-public-export-plus` (MIT licence, updated 21 November 2026).

### How the index is built

A small script runs when the site is built:

1. Load the weapon files (Primary, Secondary, Melee, Arch-Gun, Arch-Melee, SentinelWeapons).
2. For each weapon, read its recipe components and keep the ones that are themselves weapons.
3. Add up copy counts. Some recipes list the same weapon twice instead of once with a count of 2 (Akbolto lists Bolto twice), so counts must be summed rather than read from one line.
4. Write two indexes: "made from" and "used to build".
5. Read each weapon's `imageName` and the update that introduced it.
6. Download any picture that is new or has changed from the WFCD image server (`https://cdn.warframestat.us/img/` followed by the image name), convert it to WebP in both sizes, and store it with the site.
7. Save the result as one small JSON file that the site loads at start-up.

A test run of this process against the current data found the 46 ingredient weapons listed in Appendix A.

### Example record

```json
{
  "name": "Bolto",
  "slot": "Secondary",
  "image": "img/bolto.webp",
  "thumb": "img/thumb/bolto.webp",
  "introduced": "Vanilla",
  "isNew": false,
  "usedToBuild": [
    { "name": "Akbolto", "copies": 2 },
    { "name": "Hystrix", "copies": 1 }
  ],
  "madeFrom": [
    { "name": "Lato", "copies": 1 }
  ]
}
```

### Keeping it fresh

The data refreshes once a month.

- A scheduled GitHub Actions job runs on the 1st of every month at 06:00 UTC (6am UK time in winter, 7am in summer).
- It installs the latest version of `@wfcd/items`, rebuilds the index, downloads any new or changed weapon pictures, and redeploys the site.
- It compares the new data with last month's and writes a short change log: weapons added, recipes changed, pictures updated. That log feeds the "New" badges and the "New this month" strip.
- If nothing changed, it skips the redeploy.
- If the build fails (for example, the data format changed), the site keeps last month's data and the job sends an email alert instead of publishing broken data.
- The same job can also be started by hand with one button (a manual trigger), for times when a big game update lands mid-month and you don't want to wait. Monthly stays the default.

### Known data cautions

- Before launch, check a sample of entries against the WARFRAME Wiki, especially unusual ones such as Akstiletto feeding Sarpa.
- Warframes, companions and Archwing parts can also be recipe ingredients. They are left out of version 1 to keep the scope tight, and are listed for phase 3.

## 7. Pages

| Page | Address | Purpose |
| --- | --- | --- |
| Home | `/` | Search box and Sell Check |
| Weapon | `/w/bolto` | Verdict, family tree, recipe details |
| Ingredient index | `/ingredients` | All ingredient weapons |
| My Arsenal | `/arsenal` | Checklist and progress |
| Slot sweep | `/sweep` | What can I sell right now |
| Build planner | `/plan` | Everything needed for a target weapon |
| About | `/about` | Data source, disclaimer, how to report errors |

## 8. Look and feel

- Built around the Space Heroes emblem style: black shapes, thin white edges, mid-grey backgrounds, with one accent colour for verdicts (green for Safe, amber for Check, red for Keep).
- Clean and fast rather than decorative. The verdict should be readable at a glance.
- In-game weapon pictures are the only game art used (see 5.11 and Section 10). No Warframe or Digital Extremes logos, key art or screenshots in the interface.

## 9. Suggested technology

| Part | Choice | Why |
| --- | --- | --- |
| Framework | Vite with React, in TypeScript | Fast to build, widely documented |
| Search | Fuse.js | Typo-tolerant search with no server |
| Storage | Browser local storage, plus file export and import | No accounts needed |
| Hosting | Cloudflare Pages, GitHub Pages or Netlify (free tiers) | Static site, free to run |
| Offline | Vite PWA plugin | Installable on phones |
| Data updates | GitHub Actions on a monthly schedule, with a manual trigger | Keeps weapons and recipes current automatically |
| Weapon pictures | Downloaded during the monthly build, converted to WebP with the Sharp library | Fast, light pictures hosted with the site |
| Phase 3 server | Supabase (free tier) | Only needed for clan sharing |

## 10. Naming, legal and disclaimers

- "Forgeline" was chosen because it describes a weapon's line of descent through the Foundry. A quick search in November 2026 found no existing Warframe tool with this name. Check domain availability (for example forgeline.app or forgeline.gg) before committing.
- Keep "Warframe" out of the domain name and logo, since it is Digital Extremes' trademark.
- Show a footer disclaimer: "Forgeline is a fan-made tool and is not affiliated with or endorsed by Digital Extremes. Warframe is a trademark of Digital Extremes Ltd."
- Weapon pictures are Digital Extremes' game assets. The Warframe Content Policy (last updated 16 July 2020) allows fans to use Warframe assets as long as the use is non-commercial. In practice this means:
  - Forgeline must stay free. No paywalls, paid tiers or charging for access.
  - Passive adverts are allowed if they never block the content, but the simplest path is no adverts at all.
  - Warframe and Digital Extremes logos cannot be used without written permission.
- Re-read the Content Policy before launch in case it has been updated.
- Credit the Warframe Community Developers for the data and the image server.

## 11. Roadmap

| Phase | Contents | Outcome |
| --- | --- | --- |
| 1. Minimum viable site | Search, Sell Check without personal data (Check verdicts), weapon pages with one level of family tree, weapon pictures throughout, ingredient index, monthly automated data and picture refresh, About page | Anyone can answer "what does this build?" |
| 2. Personal | My Arsenal, full verdict rules, slot sweep, build planner, full-depth family tree, offline and install support | Verdicts become personal: Keep or Safe for your account |
| 3. Social and wider | Share links, clan page, Warframes, companions and Archwing parts as ingredients, translations (the data package already includes other languages) | A clan tool, covering every recipe type |

## 12. How to tell it is working

- A first-time visitor gets an answer in under five seconds.
- No wrong verdicts on the ingredient list when checked against the wiki.
- Players come back after a game update.
- Clan members use it without being reminded.

## 13. Decisions still open

1. Domain name and hosting account.
2. Whether to show Space Heroes branding (for example "Built by the Space Heroes clan") or keep it neutral.
3. Whether Warframes and companions should move into phase 1 or 2.
4. Which email address receives the alert if a monthly refresh fails.

---

## Appendix A. Current ingredient weapons

Generated from `@wfcd/items` version 1.1276.51 (14 November 2026). Counts are copies needed per recipe. Verify against the WARFRAME Wiki before launch.

| Ingredient weapon | Slot | Used to build (copies needed) |
| --- | --- | --- |
| Akbolto | Secondary | Akjagara (1) |
| Akstiletto | Secondary | Aksomati (1), Sarpa (1) |
| Amphis | Melee | Sydon (1) |
| Ankyros | Melee | Ripkas (1), Tekko (1) |
| Atomos | Secondary | Twin Basolk (1) |
| Bo | Melee | Cadus (1), Tipedo (1) |
| Bolto | Secondary | Akbolto (2), Hystrix (1) |
| Boltor | Primary | Boltace (1) |
| Broken War | Melee | War (1) |
| Bronco | Secondary | Akbronco (2) |
| Bronco Prime | Secondary | Akbronco Prime (2) |
| Cernos | Primary | Mutalist Cernos (1) |
| Cestra | Secondary | Dual Cestra (2) |
| Drakgoon | Primary | Zarr (1) |
| Dual Cleavers | Melee | Ripkas (1) |
| Dual Kamas | Melee | Dual Raza (1) |
| Dual Skana | Melee | Akjagara (1), Dark Split-Sword (1), Redeemer (1) |
| Dual Zoren | Melee | Twin Basolk (1) |
| Furax | Melee | Knux (1) |
| Furis | Secondary | Afuris (2) |
| Galatine | Melee | Paracesis (1) |
| Gammacor | Secondary | Heliocor (1) |
| Grakata | Primary | Twin Grakatas (2) |
| Hikou | Secondary | Panthera (1) |
| Kama | Melee | Dual Kamas (2) |
| Kogake | Melee | Hirudo (1) |
| Kohmak | Secondary | Twin Kohmak (2) |
| Kraken | Secondary | Kulstar (1) |
| Krohkur | Melee | Twin Krohkur (2) |
| Kronen | Melee | Boltace (1) |
| Kunai | Secondary | Tipedo (1) |
| Lato | Secondary | Bolto (1) |
| Latron | Primary | Tiberon (1) |
| Lex | Secondary | Aklex (2) |
| Lex Prime | Secondary | Aklex Prime (2) |
| Magistar | Melee | Sibear (1) |
| Magnus | Secondary | Akmagnus (2) |
| Magnus Prime | Secondary | Akmagnus Prime (2) |
| Miter | Primary | Panthera (1) |
| Mutalist Cernos | Primary | Proboscis Cernos (1) |
| Nikana | Melee | Dragon Nikana (1) |
| Ninkondi | Melee | Shaku (1) |
| Tipedo | Melee | Lesion (1) |
| Vasto | Secondary | Akvasto (2), Redeemer (1) |
| Vasto Prime | Secondary | Akvasto Prime (2) |
| Viper | Secondary | Hystrix (1), Twin Vipers (2) |
