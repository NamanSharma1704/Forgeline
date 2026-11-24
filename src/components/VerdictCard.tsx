import Link from 'next/link';
import type { RecipeSummary } from '@/data/recipe';
import type { Explanation, Tone, Verdict } from '@/engine';
import { CopyResult } from './CopyResult';
import { Icon, type IconName } from './Icon';
import { RecipeList } from './RecipeList';
import { StatusPicker } from './StatusPicker';
import { WeaponArt, type ArtWeapon } from './WeaponArt';

/**
 * The Sell Check result (spec 5.1 and 5.2): the verdict in icon, word and colour, the reason under
 * it, one row per weapon it builds with picture and copy count, the chain beyond, the mastery note,
 * and Copy result.
 *
 * With `controls`, each row also carries the player's status for that weapon, so a Check resolves
 * into Keep or Safe on the card itself (docs/verdict-rules.md, rule 2). PersonalVerdict renders it
 * that way, recomputing the verdict in the browser as the statuses change.
 */

export interface CardTarget extends ArtWeapon {
  readonly slug: string;
  /** What one build of it takes, for the row's peek. */
  readonly recipe?: RecipeSummary;
}

const ICON: Record<Tone, IconName> = {
  safe: 'safe',
  'safe-soft': 'safe',
  check: 'check',
  keep: 'keep',
};

export function VerdictCard({
  verdict,
  explanation,
  targets,
  names,
  controls = false,
  footnote,
}: {
  verdict: Verdict;
  explanation: Explanation;
  /** The weapons it builds, in verdict order. */
  targets: readonly CardTarget[];
  /** Display names for every slug that appears in a chain. */
  names: Readonly<Record<string, string>>;
  /** Show a status picker on each row. */
  controls?: boolean;
  /** One line under the rows: where the verdict comes from, or how to make it personal. */
  footnote?: React.ReactNode;
}) {
  const e = explanation;

  // Chains that reach past the first step; one step is already the row itself.
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
        <Icon name={ICON[e.tone]} className="verdict__icon" size={36} />
        <div className="verdict__words">
          <h2 id="verdict-headline" className="verdict__headline">
            {e.headline}
          </h2>
          <p className="verdict__summary">{e.summary}</p>
        </div>
      </div>

      {targets.length > 0 && (
        <div className="verdict__section">
          <h3 className="verdict__label">Used to build</h3>
          <ul className={`verdict__rows${controls ? ' verdict__rows--controls' : ''}`}>
            {targets.map((target, index) => (
              <li key={target.slug} className="verdict__row">
                <Link href={`/w/${target.slug}/`} className="verdict__target">
                  <WeaponArt weapon={target} />
                  <span className="verdict__target-name">{target.name}</span>
                </Link>
                <span className="verdict__note">{e.notes[index]}</span>
                {controls && (
                  <span className="verdict__control">
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
            ))}
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
                  {chain.map((slug, step) => (
                    <li key={slug} className="chain__step">
                      {step > 0 && <Icon name="arrow-right" size={16} className="chain__arrow" />}
                      {step === 0 ? (
                        <span className="chain__name chain__name--self">{names[slug] ?? slug}</span>
                      ) : (
                        <Link href={`/w/${slug}/`} className="chain__name">
                          {names[slug] ?? slug}
                        </Link>
                      )}
                    </li>
                  ))}
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

      {e.incarnon && (
        <p className="verdict__mastery verdict__incarnon">
          <Icon name="incarnon" size={20} />
          <span>{e.incarnon}</span>
        </p>
      )}

      <CopyResult text={e.copyText} />
    </section>
  );
}
