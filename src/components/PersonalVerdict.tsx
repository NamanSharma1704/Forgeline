'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { createEvaluator, explain, isArsenalSetUp, type Explanation, type Verdict } from '@/engine';
import { favouriteIn, toEngineArsenal } from '@/store/arsenal';
import { useArsenal } from '@/store/useArsenal';
import { useRecipeGraph } from '@/store/useRecipeGraph';
import { VerdictCard, type CardTarget } from './VerdictCard';

/**
 * The verdict card made personal (spec 5.2). The page is pre-rendered with the empty-arsenal
 * verdict, which is what everyone sees first and what search engines index. Once the player has
 * recorded anything, the same pure engine runs here against their arsenal and the card re-renders.
 * Marking a weapon on the card updates the verdict in place.
 */
export function PersonalVerdict({
  slug,
  initialVerdict,
  initialExplanation,
  targets,
  names,
  ranks,
  plan,
}: {
  slug: string;
  initialVerdict: Verdict;
  initialExplanation: Explanation;
  targets: readonly CardTarget[];
  names: Readonly<Record<string, string>>;
  ranks?: Readonly<Record<string, number>>;
  plan?: { readonly href: string; readonly label: string };
}) {
  const { ready, arsenal } = useArsenal();
  const entries = toEngineArsenal(arsenal);
  const personal = ready && isArsenalSetUp(entries);
  const { graph, status } = useRecipeGraph(personal);

  const computed = useMemo(() => {
    if (!personal || !graph) return null;
    const verdict = createEvaluator(graph, entries).verdict(slug);
    return { verdict, explanation: explain(verdict, graph) };
  }, [personal, graph, entries, slug]);

  const verdict = computed?.verdict ?? initialVerdict;
  const explanation = computed?.explanation ?? initialExplanation;

  let footnote: React.ReactNode;
  if (computed) {
    footnote = (
      <>
        Based on your arsenal, saved in this browser. <Link href="/arsenal/">Open My Arsenal</Link>
      </>
    );
  } else if (personal && status === 'error') {
    footnote = 'Could not load the recipe data to personalise this. Reload to try again.';
  } else if (personal) {
    footnote = 'Checking your arsenal…';
  } else if (targets.length > 0) {
    footnote = 'Mark these weapons and the verdict updates for your own arsenal.';
  }

  return (
    <VerdictCard
      verdict={verdict}
      explanation={explanation}
      targets={targets}
      names={names}
      ranks={ranks}
      plan={plan}
      controls={targets.length > 0}
      footnote={footnote}
      favourite={ready && favouriteIn(arsenal, slug)}
    />
  );
}
