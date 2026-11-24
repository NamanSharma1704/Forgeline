import Link from 'next/link';
import type { Explanation, Tone, Verdict } from '@/engine';
import { CopyResult } from './CopyResult';
import { Icon, type IconName } from './Icon';
import { WeaponArt, type ArtWeapon } from './WeaponArt';

/**
 * The Sell Check result (spec 5.1 and 5.2): the verdict in icon, word and colour, the reason under
 * it, one row per weapon it builds with picture and copy count, the chain beyond, the mastery note,
 * and Copy result. Renders on the server; the engine and explainer are pure, so phase 2 can render
 * the same card in the browser once the stored arsenal is known.
 */

export interface CardTarget extends ArtWeapon {
  readonly slug: string;
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
}: {
  verdict: Verdict;
  explanation: Explanation;
  /** The weapons it builds, in verdict order. */
  targets: readonly CardTarget[];
  /** Display names for every slug that appears in a chain. */
  names: Readonly<Record<string, string>>;
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
          <ul className="verdict__rows">
            {targets.map((target, index) => (
              <li key={target.slug} className="verdict__row">
                <Link href={`/w/${target.slug}/`} className="verdict__target">
                  <WeaponArt weapon={target} />
                  <span className="verdict__target-name">{target.name}</span>
                </Link>
                <span className="verdict__note">{e.notes[index]}</span>
              </li>
            ))}
          </ul>
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

      <CopyResult text={e.copyText} />
    </section>
  );
}
