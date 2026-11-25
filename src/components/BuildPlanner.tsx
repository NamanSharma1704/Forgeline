'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { RecipeSummary } from '@/data/recipe';
import type { RecipeFile } from '@/data/recipe-file';
import { DECAYING_RESOURCES, RARE_RESOURCES } from '@/data/resources';
import { foundryTime, planBuild, totalResources, type PlanLine } from '@/engine';
import { toEngineArsenal } from '@/store/arsenal';
import { useArsenal } from '@/store/useArsenal';
import { useRecipeGraph } from '@/store/useRecipeGraph';
import { useStaticJson } from '@/store/useStaticJson';
import type { TileWeapon } from './parts/ArsenalTile';
import { FoundrySlot } from './parts/FoundrySlot';
import { LiveTile } from './parts/LiveTile';
import { RecipeSlots } from './parts/RecipeSlots';
import { QtyStepper } from './QtyStepper';
import { Telemetry } from './shell/ScreenHeader';
import { StatusPicker } from './StatusPicker';
import { longTime, shortTime } from '@/format/time';
import { WeaponSearch } from './WeaponSearch';

/**
 * The build planner (spec 5.6) as the Foundry (design plan 9): pick a weapon you want, and see
 * every weapon needed down the whole chain as a queue of stage trays. A blueprint header with the
 * target's tile and its Foundry times; each stage a tray of blueprint cards, each with the weapon's
 * tile, its build time, the player's status and copies for it, and what that step takes as Foundry
 * slots; then the materials for everything left, as slots too. Marking what you get shrinks the
 * plan as you go. The target lives in the URL (?w=akjagara), so a plan can be bookmarked or shared.
 */

const SUGGESTED = ['akjagara', 'redeemer', 'proboscis-cernos', 'dual-raza', 'lesion', 'twin-basolk'];

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** A stage tray's code and when it can start: "STAGE 01 // start now", "FINAL // the final build". */
function stageLabel(number: number, last: number): [string, string] {
  const code = last > 1 && number === last ? 'Final' : `Stage ${String(number).padStart(2, '0')}`;
  if (number === 1) return [code, 'start now'];
  if (number === last) return [code, 'the final build'];
  return [code, `once stage ${String(number - 1).padStart(2, '0')} is built`];
}

export function BuildPlanner() {
  const [target, setTarget] = useState<string | null>(null);
  const { arsenal } = useArsenal();
  const { graph, slots, ranks, status } = useRecipeGraph(true);
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
  const tile = (slug: string): TileWeapon => ({
    slug,
    name: name(slug),
    slot: slots?.get(slug) ?? 'primary',
    thumb: `img/thumb/${slug}.webp`,
    image: `img/${slug}.webp`,
    mr: ranks?.get(slug) ?? 0,
  });

  /** What one step takes, for every copy it makes: its weapons, then the rest. */
  const stepRecipe = (line: PlanLine): RecipeSummary => ({
    slug: line.slug,
    name: name(line.slug),
    weapons: (graph?.get(line.slug).madeFrom ?? []).map((edge) => ({
      slug: edge.slug,
      name: name(edge.slug),
      copies: edge.copies * line.toMake,
    })),
    materials: (recipes?.[line.slug]?.materials ?? []).map((material) => ({
      ...material,
      count: material.count * line.toMake,
    })),
  });
  const artFor = (line: PlanLine) =>
    Object.fromEntries((graph?.get(line.slug).madeFrom ?? []).map((edge) => [edge.slug, tile(edge.slug)]));

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
          <section className="blueprint-head shape shape--frame" aria-labelledby="plan-title">
            <div className="blueprint-head__tile">
              <LiveTile weapon={tile(plan.target)} href={`/w/${plan.target}/`} />
            </div>
            <div className="blueprint-head__body">
              <p className="blueprint-head__kicker">Target blueprint</p>
              <h2 id="plan-title" className="blueprint-head__title">
                {name(plan.target)}
              </h2>
              <p className="muted">
                {plan.lines.length - 1 === 0
                  ? 'No other weapons go into it.'
                  : `${plan.lines.length - 1} other ${plural(plan.lines.length - 1, 'weapon', 'weapons')} in the chain, ${plan.steps.length} ${plural(plan.steps.length, 'step', 'steps')} left.`}
              </p>
            </div>
            {foundry && foundry.fastest > 0 && (
              <div className="blueprint-head__time">
                <Telemetry label="Fastest" value={shortTime(foundry.fastest)} />
                {foundry.oneAtATime > foundry.fastest && (
                  <Telemetry label="One at a time" value={shortTime(foundry.oneAtATime)} />
                )}
              </div>
            )}
          </section>
          {foundry && foundry.fastest > 0 && (
            <p className="verdict__footnote">
              {longTime(foundry.fastest)} in the Foundry at best, starting each build as soon as what it
              needs is ready: the Foundry runs any number at once.
              {foundry.unknown.length > 0 &&
                ` ${foundry.unknown.map(name).join(' and ')} ${plural(foundry.unknown.length, 'has', 'have')} no build time in the data, so ${plural(foundry.unknown.length, 'it is', 'they are')} not counted.`}
            </p>
          )}

          <section className="section" aria-labelledby="plan-steps">
            <h3 id="plan-steps" className="section-title">
              Foundry queue
            </h3>

            {(foundry ? foundry.stages : [{ number: 1, steps: plan.steps }]).map((stage, _, stages) => {
              const [code, when] = stageLabel(stage.number, stages.length);
              return (
                <div key={stage.number} className="stage-tray">
                  <h4 className="stage-tray__label">
                    <span className="stage-tray__code">{code}</span>
                    <span aria-hidden="true">{' // '}</span>
                    <span className="sr-only">: </span>
                    {when}
                  </h4>
                  <ol className="stage-tray__cards">
                    {stage.steps.map((step) => {
                      const verb = step.craftable ? 'Build' : 'Get';
                      const isTarget = step.slug === plan.target;
                      const seconds = recipes?.[step.slug]?.buildTime;
                      const recipe = stepRecipe(step);
                      const hasSlots = recipe.weapons.length > 0 || recipe.materials.length > 0;
                      return (
                        <li key={step.slug} className="blueprint blueprint--plan">
                          <LiveTile weapon={tile(step.slug)} size="small" href={`/w/${step.slug}/`} />
                          <div className="blueprint__body">
                            <p className="blueprint__head">
                              <span className="blueprint__name">
                                {verb} {step.toMake > 1 ? `${step.toMake} ` : ''}
                                {name(step.slug)}
                              </span>
                              {recipes && (
                                <span className="blueprint__needs">
                                  {seconds
                                    ? `${shortTime(seconds)}${step.toMake > 1 ? ', all at once' : ''}`
                                    : 'Time unknown'}
                                </span>
                              )}
                            </p>
                            <p className="blueprint__note">
                              {step.usedFor.length > 0 &&
                                `For ${step.usedFor.map((u) => `${name(u.slug)} (${u.copies})`).join(', ')}. `}
                              {step.have > 0 && `You have ${step.have} of the ${step.needed} needed.`}
                            </p>
                            {!isTarget && (
                              <div className="blueprint__controls">
                                <StatusPicker slug={step.slug} name={name(step.slug)} size="small" />
                                {step.needed > 1 && <QtyStepper slug={step.slug} name={name(step.slug)} />}
                              </div>
                            )}
                          </div>
                          {hasSlots && (
                            <div className="blueprint__slots">
                              <RecipeSlots recipe={recipe} art={artFor(step)} />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}
            <p className="verdict__footnote">
              Mark what you get as you go: copies you hold count towards the plan, and the steps below
              them drop away. Times assume you build every step; a weapon bought ready-made from the
              Market takes no Foundry time.
            </p>
          </section>

          {plan.lines.length > 1 && (
            <section className="section" aria-labelledby="plan-all">
              <h3 id="plan-all" className="section-title">
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
                            <span className="cell-weapon__mr">MR {ranks?.get(line.slug) ?? 0}</span>
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
              <h3 id="plan-resources" className="section-title">
                Materials for the steps left
              </h3>
              <ul className="recipe-slots materials">
                {totals.map((total) => (
                  <li key={total.name}>
                    <FoundrySlot
                      name={total.name}
                      need={total.count}
                      tag={
                        DECAYING_RESOURCES.has(total.name)
                          ? 'Decays daily'
                          : RARE_RESOURCES.has(total.name)
                            ? 'Rare'
                            : undefined
                      }
                    />
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
