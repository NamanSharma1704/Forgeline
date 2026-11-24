import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { WeaponArt } from '@/components/WeaponArt';
import { allWeapons, forwardChain, getWeapon, resolve } from '@/data/weapons';
import { SLOT_LABEL } from '@/data/types';

type Params = { slug: string };

/** One static page per weapon. 621 today, and they are cheap: the data is already in the bundle. */
export function generateStaticParams(): Params[] {
  return allWeapons().map((weapon) => ({ slug: weapon.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const weapon = getWeapon(slug);
  if (!weapon) return { title: 'Unknown weapon' };

  const builds = weapon.usedToBuild.map((edge) => resolve(edge.slug).name);
  return {
    title: weapon.name,
    description: builds.length
      ? `${weapon.name} is used to build ${builds.join(' and ')}. Check before you sell it.`
      : `${weapon.name} is not used in any weapon recipe.`,
  };
}

export default async function WeaponPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const weapon = getWeapon(slug);
  if (!weapon) notFound();

  const chain = forwardChain(weapon.slug);
  const isIngredient = weapon.usedToBuild.length > 0;

  return (
    <>
      <div className="weapon-head">
        <WeaponArt weapon={weapon} size="large" priority />
        <div className="weapon-head__text">
          <p className="eyebrow">{SLOT_LABEL[weapon.slot]}</p>
          <h1>{weapon.name}</h1>
          <ul className="badges">
            <li className="badge">Mastery rank {weapon.masteryReq}</li>
            <li className="badge">Added in {weapon.introduced}</li>
            {weapon.isNew && <li className="badge badge--new">New</li>}
          </ul>
        </div>
      </div>

      <section className="section">
        <h2>Used to build</h2>
        {isIngredient ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Weapon</th>
                  <th scope="col">Copies needed</th>
                  <th scope="col">Which then builds</th>
                </tr>
              </thead>
              <tbody>
                {weapon.usedToBuild.map((edge) => {
                  const target = resolve(edge.slug);
                  return (
                    <tr key={edge.slug}>
                      <th scope="row">
                        <Link href={`/w/${target.slug}/`} className="cell-weapon">
                          <WeaponArt weapon={target} />
                          {target.name}
                        </Link>
                      </th>
                      <td className="copies">{edge.copies}</td>
                      <td className="muted">
                        {target.usedToBuild.length
                          ? target.usedToBuild
                              .map((next) => resolve(next.slug).name)
                              .join(', ')
                          : 'end of the chain'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="lede">
            Nothing. {weapon.name} is not an ingredient in any weapon recipe, so selling it costs you
            no future build.
          </p>
        )}
      </section>

      {weapon.madeFrom.length > 0 && (
        <section className="section">
          <h2>Made from</h2>
          <ul className="weapon-grid">
            {weapon.madeFrom.map((edge) => {
              const source = resolve(edge.slug);
              return (
                <li key={edge.slug}>
                  <Link href={`/w/${source.slug}/`} className="weapon-card">
                    <WeaponArt weapon={source} />
                    <span>
                      <span className="weapon-card__name">{source.name}</span>
                      <br />
                      <span className="weapon-card__meta">
                        {edge.copies} {edge.copies === 1 ? 'copy' : 'copies'}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="muted" style={{ marginTop: 10 }}>
            Weapon ingredients only. Resources such as Orokin Cells are part of the recipe but are not
            tracked here.
          </p>
        </section>
      )}

      {chain.length > 1 && (
        <section className="section">
          <h2>The rest of the chain</h2>
          <ol className="chain">
            <li className="badge">{weapon.name}</li>
            {chain.map((level, depth) => (
              <li key={depth} className="chain__level">
                <span className="chain__arrow" aria-hidden="true">
                  &rarr;{' '}
                </span>
                {level.map((next, i) => (
                  <span key={next.slug}>
                    {i > 0 && ' / '}
                    <Link href={`/w/${next.slug}/`}>{next.name}</Link>
                  </span>
                ))}
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
