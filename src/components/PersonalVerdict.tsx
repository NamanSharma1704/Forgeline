'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { createEvaluator, explain, isArsenalSetUp, type Explanation, type Verdict } from '@/engine';
import { favouriteIn, toEngineArsenal } from '@/store/arsenal';
import { useRouter } from 'next/navigation';
import { useArsenal } from '@/store/useArsenal';
import { useRecipeGraph } from '@/store/useRecipeGraph';
import { hasMovedInApp, useScreenActions, type ScreenAction } from './shell/actions';
import { useCopyText } from './useCopyText';
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

  // The weapon screen's actions (design plan 4.4): copy for clan chat, plan a build, back.
  const router = useRouter();
  const { state: copyState, copy } = useCopyText(explanation.copyText);
  const actions: ScreenAction[] = [
    {
      id: 'copy',
      keyName: 'c',
      icon: copyState === 'copied' ? 'done' : 'copy',
      label: copyState === 'copied' ? 'Copied' : 'Copy for clan chat',
      run: copy,
    },
    // The weapon is on screen, so the label needs no name: it stays short enough for a phone.
    ...(plan ? [{ id: 'plan', keyName: 'p', icon: 'queue' as const, label: 'Plan a build', href: plan.href, primary: true }] : []),
    {
      id: 'back',
      keyName: 'Escape',
      icon: 'back',
      label: 'Back',
      compact: true,
      run: () => (hasMovedInApp() ? router.back() : router.push('/')),
    },
  ];
  useScreenActions('weapon', actions);

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
    <>
      <VerdictCard
        verdict={verdict}
        explanation={explanation}
        targets={targets}
        names={names}
        ranks={ranks}
        controls={targets.length > 0}
        footnote={footnote}
        favourite={ready && favouriteIn(arsenal, slug)}
      />
      <span className="sr-only" role="status" aria-live="polite">
        {copyState === 'copied' ? 'Result copied. Paste it into clan chat.' : ''}
      </span>
      {copyState === 'failed' && (
        <p className="copy-result__fallback">
          Copying is blocked here. Select this instead:
          <output className="copy-result__text">{explanation.copyText}</output>
        </p>
      )}
    </>
  );
}
