import Link from 'next/link';
import type { RecipeSummary } from '@/data/recipe';
import type { Explanation, Tone, Verdict } from '@/engine';
import { Icon, type IconName } from './Icon';
import type { TileWeapon } from './parts/ArsenalTile';
import { LiveTile } from './parts/LiveTile';
import { DiamondNode } from './parts/marks';
import { RecipeSlots } from './parts/RecipeSlots';
import { StatusPicker } from './StatusPicker';

/**
 * The Sell Check result (spec 5.1 and 5.2) as the dossier's verdict panel (design plan 6.2): a flat
 * panel with a 3 px edge in the verdict's colour, the crest, the engine's headline in capitals
 * (its words and counts unchanged) and the reason. Then each weapon it builds as a Foundry
 * blueprint row: its tile, NEEDS ×2, the reason, the player's status for it, and what one build
 * takes in Foundry slots. Then the chain beyond as small tiles joined by diamonds, the weapon itself
 * in gold, and the notes. Copy for clan chat and Plan a build live in the action bar.
 *
 * With `controls`, each row carries the player's status for that weapon, so a Check resolves into
 * Keep or Safe on the card itself (docs/verdict-rules.md, rule 2). PersonalVerdict renders it that
 * way, recomputing the verdict in the browser as the statuses change.
 */

export interface CardTarget extends TileWeapon {
  /** What one build of it takes, for the row's Foundry slots. */
  readonly recipe?: RecipeSummary;
}

const ICON: Record<Tone, IconName> = {
  safe: 'safe',
  'safe-soft': 'safe',
  check: 'check',
  keep: 'keep',
};

/**
 * What one target means for the verdict, for its card's accent line: copies spoken for (keep),
 * nothing more needed (safe), or not known yet or worth a look (check). The note says it in words.
 */
function lineTone(verdict: Verdict, index: number): 'safe' | 'check' | 'keep' {
  if (verdict.kind === 'check') return 'check';
  const target = verdict.targets[index];
  switch (target?.reason) {
    case 'needs-building':
    case 'feeds-chain':
      return 'keep';
    case 'mastered':
      return 'safe';
    default:
      return 'check';
  }
}

/** Copies of the checked weapon that one build of this target consumes. */
function perBuild(verdict: Verdict, index: number): number {
  const target = verdict.targets[index];
  if (!target) return 0;
  return 'copiesPerBuild' in target ? target.copiesPerBuild : target.copies;
}

/** "Hard to get back: it is vaulted..." as a title and its sentence. */
function splitLead(sentence: string): [string | null, string] {
  const match = /^([^:]{3,40}): (.+)$/.exec(sentence);
  return match ? [match[1]!, match[2]!.replace(/^./, (c) => c.toUpperCase())] : [null, sentence];
}

export function VerdictCard({
  verdict,
  explanation,
  targets,
  tiles,
  controls = false,
  footnote,
  favourite = false,
}: {
  verdict: Verdict;
  explanation: Explanation;
  /** The weapons it builds, in verdict order. */
  targets: readonly CardTarget[];
  /** Tiles for every weapon a chain or a recipe on the card can show, by slug. */
  tiles: Readonly<Record<string, TileWeapon>>;
  /** Show a status picker on each card. */
  controls?: boolean;
  /** One line under the cards: where the verdict comes from, or how to make it personal. */
  footnote?: React.ReactNode;
  /** The player starred it: say so beside the verdict, which recipes alone decide. */
  favourite?: boolean;
}) {
  const e = explanation;
  const safe = e.tone === 'safe' || e.tone === 'safe-soft';
  const [recoveryTitle, recoveryText] = e.recovery ? splitLead(e.recovery) : [null, ''];

  // Chains that reach past the first step; one step is already the card itself.
  const seen = new Set<string>();
  const chains = verdict.targets
    .flatMap((target) => target.chains)
    .map((chain) => [verdict.slug, ...chain])
    .filter((chain) => chain.length > 2)
    .filter((chain) => {
      const key = chain.join('>');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return (
    <section className={`verdict verdict--${e.tone} shape`} aria-labelledby="verdict-headline">
      <div className="verdict__banner">
        <span className="verdict__crest">
          <Icon name={ICON[e.tone]} className="verdict__icon" size={44} />
        </span>
        <div className="verdict__words">
          <h2 id="verdict-headline" className="verdict__headline">
            {e.headline}
          </h2>
          <p className="verdict__summary">{e.summary}</p>
        </div>
      </div>

      {/* Where selling is the next move, the reason to think twice sits right under it. */}
      {e.recovery && safe && (
        <div className="recovery-card">
          <Icon name="check" size={20} className="recovery-card__icon" />
          <p>
            {recoveryTitle && <strong className="recovery-card__title">{recoveryTitle}</strong>}
            <span className="recovery-card__text">{recoveryText}</span>
          </p>
        </div>
      )}
      {favourite && (
        <p className="verdict__favourite">
          <Icon name="star" size={18} />
          <span>Your favourite: the sweep never suggests selling it, whatever the recipes say.</span>
        </p>
      )}

      {targets.length > 0 && (
        <div className="verdict__section">
          <h3 className="verdict__label">Used to build</h3>
          <ul className="blueprints">
            {targets.map((target, index) => {
              const copies = perBuild(verdict, index);
              return (
                <li key={target.slug} className="blueprint" data-tone={lineTone(verdict, index)}>
                  <LiveTile weapon={target} size="small" href={`/w/${target.slug}/`} />
                  <div className="blueprint__body">
                    <p className="blueprint__head">
                      <span className="blueprint__name">{target.name}</span>
                      <span className="blueprint__needs">
                        Needs <strong>×{copies}</strong>
                        <span className="sr-only"> per build</span>
                      </span>
                    </p>
                    <p className="blueprint__note">{e.notes[index]}</p>
                    {controls && <StatusPicker slug={target.slug} name={target.name} size="small" />}
                  </div>
                  {target.recipe && (
                    <details className="blueprint__peek">
                      <summary>
                        <Icon name="arrow-right" size={14} className="blueprint__chevron" />
                        What {target.name} takes
                      </summary>
                      <div className="blueprint__slots">
                        <RecipeSlots recipe={target.recipe} art={tiles} />
                        <Link href={`/plan/?w=${target.slug}`} className="blueprint__plan">
                          Plan a full build of {target.name}
                          <Icon name="arrow-right" size={16} />
                        </Link>
                      </div>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
          {footnote && <p className="verdict__footnote">{footnote}</p>}
        </div>
      )}

      {chains.length > 0 && (
        <div className="verdict__section">
          <h3 className="verdict__label">Down the chain</h3>
          <ul className="lineages">
            {chains.map((chain) => (
              <li key={chain.join('>')}>
                <ol className="lineage" aria-label={chain.map((slug) => tiles[slug]?.name ?? slug).join(', then ')}>
                  {chain.map((slug, step) => {
                    const tile = tiles[slug];
                    return (
                      <li key={slug} className="lineage__step">
                        {step > 0 && (
                          <span className="lineage__link" aria-hidden="true">
                            <DiamondNode tone="steel" />
                          </span>
                        )}
                        {tile ? (
                          <LiveTile weapon={tile} size="small" href={step === 0 ? undefined : `/w/${slug}/`} selected={step === 0} />
                        ) : (
                          <span>{slug}</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
          </ul>
        </div>
      )}

      {e.mastery && (
        <p className="verdict__mastery">
          <Icon name="info" size={20} />
          <span>{e.mastery}</span>
        </p>
      )}

      {e.recovery && !safe && (
        <p className="verdict__mastery verdict__recovery">
          <Icon name="info" size={20} />
          <span>{e.recovery}</span>
        </p>
      )}

      {e.incarnon && (
        <p className="verdict__mastery verdict__incarnon">
          <Icon name="incarnon" size={20} />
          <span>{e.incarnon}</span>
        </p>
      )}
    </section>
  );
}
