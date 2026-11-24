'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { RecipeFile } from '@/data/recipe-file';
import { foundryTime, planBuild, totalResources, type PlanLine } from '@/engine';
import { toEngineArsenal } from '@/store/arsenal';
import { useArsenal } from '@/store/useArsenal';
import { useRecipeGraph } from '@/store/useRecipeGraph';
import { useStaticJson } from '@/store/useStaticJson';
import { Icon } from './Icon';
import { QtyStepper } from './QtyStepper';
import { StatusPicker } from './StatusPicker';
import { WeaponArt } from './WeaponArt';
import { WeaponSearch } from './WeaponSearch';

/**
 * The build planner (spec 5.6): pick a weapon you want, see every weapon needed down the whole
 * chain, what you already hold, and what is left in the order to do it. Each step carries its
 * status picker, so marking what you get shrinks the plan as you go. The target lives in the URL
 * (?w=akjagara), so a plan can be bookmarked or shared.
 */

const SUGGESTED = ['akjagara', 'redeemer', 'proboscis-cernos', 'dual-raza', 'lesion', 'twin-basolk'];

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const tidy = (n: number) => Number(n.toFixed(1));

/** A step's own time: "12 h", "1 min". */
const shortTime = (seconds: number) =>
  seconds < 3600 ? `${Math.max(1, Math.round(seconds / 60))} min` : `${tidy(seconds / 3600)} h`;

/** A plan's total: "48 hours (2 days)". */
function longTime(seconds: number) {
  if (seconds < 3600) {
    const minutes = Math.max(1, Math.round(seconds / 60));
    return `${minutes} ${plural(minutes, 'minute', 'minutes')}`;
  }
  const hours = tidy(seconds / 3600);
  const days = tidy(seconds / 86400);
  return hours >= 24
    ? `${hours} hours (${days} ${plural(days, 'day', 'days')})`
    : `${hours} ${plural(hours, 'hour', 'hours')}`;
}

/** What a stage heading says about when it can start. */
function stageLabel(number: number, last: number) {
  if (last === 1) return 'Start now';
  if (number === 1) return 'Stage 1: start now';
  if (number === last) return `Stage ${number}: the final build`;
  return `Stage ${number}: once what it needs is built`;
}

export function BuildPlanner() {
  const [target, setTarget] = useState<string | null>(null);
  const { arsenal } = useArsenal();
  const { graph, slots, status } = useRecipeGraph(true);
  const recipes = useStaticJson<RecipeFile>('/materials.json', target !== null);

  // Read the target from the address once, after hydration (pages are pre-rendered without it).
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('w');
    if (fromUrl) setTarget(fromUrl);
  }, []);

  const choose = (slug: string) => {
    setTarget(slug);
    const url = new URL(window.location.href);
    url.searchParams.set('w', slug);
    window.history.replaceState(window.history.state, '', url);
  };

  const entries = toEngineArsenal(arsenal);
  const plan = useMemo(
    () => (graph && target && graph.has(target) ? planBuild(graph, entries, target) : null),
    [graph, target, entries]
  );
  const totals = useMemo(
    () => (plan && recipes ? totalResources(plan, (slug) => recipes[slug]?.materials) : null),
    [plan, recipes]
  );
  const foundry = useMemo(
    () => (graph && plan && recipes ? foundryTime(graph, plan, (slug) => recipes[slug]?.buildTime) : null),
    [graph, plan, recipes]
  );

  const name = (slug: string) => graph?.get(slug).name ?? slug;
  const art = (slug: string) => ({
    name: name(slug),
    slot: slots?.get(slug) ?? 'primary',
    thumb: `img/thumb/${slug}.webp`,
    image: `img/${slug}.webp`,
  });

  /** What one build of this weapon takes: weapon ingredients first, then everything else. */
  const recipeText = (line: PlanLine) => {
    const parts = [
      ...(graph?.get(line.slug).madeFrom ?? []).map(
        (edge) => `${name(edge.slug)}${edge.copies > 1 ? ` ${edge.copies}` : ''}`
      ),
      ...(recipes?.[line.slug]?.materials ?? []).map(
        (m) => `${m.name}${m.count > 1 ? ` ${m.count.toLocaleString('en-GB')}` : ''}`
      ),
    ];
    return parts.length ? parts.join(', ') : null;
  };

  return (
    <>
      <div className="planner-search">
        <WeaponSearch
          variant="hero"
          onSelect={(entry) => choose(entry.s)}
          placeholder="Which weapon do you want to build?"
          label="Weapon to plan"
        />
      </div>

      {!target && graph && (
        <p className="search-hint">
          Try{' '}
          {SUGGESTED.filter((slug) => graph.has(slug)).map((slug, index, list) => (
            <span key={slug}>
              <button type="button" className="link-button" onClick={() => choose(slug)}>
                {name(slug)}
              </button>
              {index < list.length - 2 ? ', ' : index === list.length - 2 ? ' or ' : '.'}
            </span>
          ))}
        </p>
      )}

      {target && status === 'error' && (
        <p className="result-count">Could not load the recipe data. Reload to try again.</p>
      )}
      {target && graph && !graph.has(target) && (
        <p className="result-count">There is no weapon called &ldquo;{target}&rdquo;. Search for one above.</p>
      )}

      {plan && (
        <>
          <section className="plan-head" aria-labelledby="plan-title">
            <div className="plan-head__art shape">
              <WeaponArt weapon={art(plan.target)} size="medium" />
            </div>
            <div>
              <h2 id="plan-title" className="section-title plan-head__title">
                Build {name(plan.target)}
              </h2>
              <p className="muted">
                {plan.lines.length - 1 === 0
                  ? 'No other weapons go into it.'
                  : `${plan.lines.length - 1} other ${plural(plan.lines.length - 1, 'weapon', 'weapons')} in the chain, ${plan.steps.length} ${plural(plan.steps.length, 'step', 'steps')} left.`}{' '}
                <Link href={`/w/${plan.target}/`}>See {name(plan.target)}</Link>
              </p>
            </div>
          </section>

          <section className="section" aria-labelledby="plan-steps">
            <h3 id="plan-steps" className="verdict__label">
              Still to do, in order
            </h3>

            {foundry && foundry.fastest > 0 && (
              <div className="foundry">
                <Icon name="clock" size={20} />
                <div>
                  <p>
                    <strong>{longTime(foundry.fastest)}</strong> in the Foundry at best, over{' '}
                    {foundry.stages.length} {plural(foundry.stages.length, 'stage', 'stages')}.
                  </p>
                  <p className="muted">
                    That is starting each build as soon as what it needs is ready: the Foundry runs
                    any number at once.
                    {foundry.oneAtATime > foundry.fastest &&
                      ` One build at a time, it would take ${longTime(foundry.oneAtATime)}.`}
                    {foundry.unknown.length > 0 &&
                      ` ${foundry.unknown.map(name).join(' and ')} ${plural(foundry.unknown.length, 'has', 'have')} no build time in the data, so ${plural(foundry.unknown.length, 'it is', 'they are')} not counted.`}
                  </p>
                </div>
              </div>
            )}

            {(foundry ? foundry.stages : [{ number: 1, steps: plan.steps }]).map((stage) => (
              <div key={stage.number} className="plan-stage">
                {foundry && (
                  <h4 className="plan-stage__label">
                    {stageLabel(stage.number, foundry.stages.length)}
                  </h4>
                )}
                <ol className="plan-steps">
                  {stage.steps.map((step) => {
                    const recipe = recipeText(step);
                    const verb = step.craftable ? 'Build' : 'Get';
                    const isTarget = step.slug === plan.target;
                    const seconds = recipes?.[step.slug]?.buildTime;
                    return (
                      <li key={step.slug} className="plan-step">
                        <div className="plan-step__main">
                          <WeaponArt weapon={art(step.slug)} />
                          <div>
                            <p className="plan-step__title">
                              <strong>
                                {verb} {step.toMake}
                              </strong>{' '}
                              <Link href={`/w/${step.slug}/`}>{name(step.slug)}</Link>
                              {recipes && (
                                <span className="plan-step__time">
                                  {seconds
                                    ? `${shortTime(seconds)}${step.toMake > 1 ? ', all at once' : ''}`
                                    : 'time unknown'}
                                </span>
                              )}
                            </p>
                            <p className="plan-step__detail">
                              {step.usedFor.length > 0 &&
                                `For ${step.usedFor.map((u) => `${name(u.slug)} (${u.copies})`).join(', ')}. `}
                              {step.have > 0 && `You have ${step.have} of the ${step.needed} needed. `}
                              {recipe && `${step.toMake > 1 ? 'Each needs' : 'Needs'} ${recipe}.`}
                            </p>
                          </div>
                        </div>
                        {!isTarget && (
                          <div className="plan-step__controls">
                            <StatusPicker slug={step.slug} name={name(step.slug)} size="small" />
                            <QtyStepper slug={step.slug} name={name(step.slug)} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
            <p className="verdict__footnote">
              Mark what you get as you go: copies you hold count towards the plan, and the steps
              below them drop away. Times assume you build every step; a weapon bought ready-made
              from the Market takes no Foundry time.
            </p>
          </section>

          {plan.lines.length > 1 && (
            <section className="section" aria-labelledby="plan-all">
              <h3 id="plan-all" className="verdict__label">
                Every weapon in the chain
              </h3>
              <div className="table-wrap shape">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Weapon</th>
                      <th scope="col">Needed</th>
                      <th scope="col">You have</th>
                      <th scope="col">To make</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.lines.map((line) => (
                      <tr key={line.slug}>
                        <th scope="row">
                          <Link href={`/w/${line.slug}/`} className="cell-weapon">
                            <WeaponArt weapon={art(line.slug)} />
                            {name(line.slug)}
                          </Link>
                        </th>
                        <td>{line.needed}</td>
                        <td className="cell-muted">{line.slug === plan.target ? 'n/a' : line.have}</td>
                        <td>{line.toMake === 0 ? <span className="cell-muted">covered</span> : line.toMake}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {totals && totals.length > 0 && (
            <section className="section" aria-labelledby="plan-resources">
              <h3 id="plan-resources" className="verdict__label">
                Resources for the steps left
              </h3>
              <ul className="resource-list">
                {totals.map((total) => (
                  <li key={total.name}>
                    <span>{total.name}</span>
                    <span className="resource-list__count">{total.count.toLocaleString('en-GB')}</span>
                  </li>
                ))}
              </ul>
              <p className="verdict__footnote">
                Listed, not tracked. Blueprints and weapon parts are in each step above.
              </p>
            </section>
          )}
        </>
      )}
    </>
  );
}
