import Link from 'next/link';
import type { RecipeSummary } from '@/data/recipe';
import type { Explanation, Tone, Verdict } from '@/engine';
import { CopyResult } from './CopyResult';
import { Icon, type IconName } from './Icon';
import { RecipeList } from './RecipeList';
import { StatusPicker } from './StatusPicker';
import { WeaponArt, type ArtWeapon } from './WeaponArt';

/**
 * The Sell Check result (spec 5.1 and 5.2), as the dossier's right column (design plan 4.3): the
 * verdict in crest, word and colour with the reason under it, one card per weapon it builds with
 * picture, copies per build and the player's status, the chain beyond with mastery ranks, the
 * notes, and the action dock (copy for clan chat, plan a build).
 *
 * With `controls`, each card also carries the player's status for that weapon, so a Check resolves
 * into Keep or Safe on the card itself (docs/verdict-rules.md, rule 2). PersonalVerdict renders it
 * that way, recomputing the verdict in the browser as the statuses change.
 */

export interface CardTarget extends ArtWeapon {
  readonly slug: string;
  /** What one build of it takes, for the card's peek. */
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
  names,
  ranks,
  controls = false,
  footnote,
  favourite = false,
  plan,
}: {
  verdict: Verdict;
  explanation: Explanation;
  /** The weapons it builds, in verdict order. */
  targets: readonly CardTarget[];
  /** Display names for every slug that appears in a chain. */
  names: Readonly<Record<string, string>>;
  /** Mastery ranks for the same slugs, shown on the chain's steps. */
  ranks?: Readonly<Record<string, number>>;
  /** Show a status picker on each card. */
  controls?: boolean;
  /** One line under the cards: where the verdict comes from, or how to make it personal. */
  footnote?: React.ReactNode;
  /** The player starred it: say so beside the verdict, which recipes alone decide. */
  favourite?: boolean;
  /** The dock's second action, when the weapon has a recipe to plan. */
  plan?: { readonly href: string; readonly label: string };
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
          <ul className="target-cards">
            {targets.map((target, index) => {
              const copies = perBuild(verdict, index);
              return (
                <li key={target.slug} className="target-card" data-tone={lineTone(verdict, index)}>
                  <Link href={`/w/${target.slug}/`} className="target-card__target">
                    <WeaponArt weapon={target} />
                    <span className="target-card__name">{target.name}</span>
                  </Link>
                  <span className="target-card__copies">
                    <strong>×{copies}</strong> per build
                  </span>
                  <span className="target-card__note">{e.notes[index]}</span>
                  {controls && (
                    <span className="target-card__control">
                      <StatusPicker slug={target.slug} name={target.name} size="small" />
                    </span>
                  )}
                  {target.recipe && (
                    <details className="recipe-peek">
                      <summary>
                        <Icon name="arrow-right" size={14} className="recipe-peek__chevron" />
                        What {target.name} takes
                      </summary>
                      <div className="recipe-peek__body">
                        <RecipeList recipe={target.recipe} compact />
                        <Link href={`/plan/?w=${target.slug}`} className="recipe-peek__plan">
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
          <ul className="verdict__chains">
            {chains.map((chain) => (
              <li key={chain.join('>')}>
                <ol className="chain" aria-label={chain.map((slug) => names[slug] ?? slug).join(', then ')}>
                  {chain.map((slug, step) => {
                    const body = (
                      <>
                        <span className="chain__name">{names[slug] ?? slug}</span>
                        {ranks?.[slug] !== undefined && <span className="chain__mr">MR {ranks[slug]}</span>}
                      </>
                    );
                    return (
                      <li key={slug} className="chain__step">
                        {step > 0 && <Icon name="arrow-right" size={16} className="chain__arrow" />}
                        {step === 0 ? (
                          <span className="chain__node chain__node--self shape">{body}</span>
                        ) : (
                          <Link href={`/w/${slug}/`} className="chain__node shape">
                            {body}
                          </Link>
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

      <div className="verdict__dock">
        <CopyResult text={e.copyText} quiet />
        {plan && (
          <Link href={plan.href} className="dock-plan shape">
            <Icon name="queue" size={18} />
            {plan.label}
            <Icon name="arrow-right" size={16} className="dock-plan__arrow" />
          </Link>
        )}
      </div>
    </section>
  );
}
