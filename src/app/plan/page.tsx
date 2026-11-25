import type { Metadata } from 'next';
import { BuildPlanner } from '@/components/BuildPlanner';
import { ScreenHeader } from '@/components/shell/ScreenHeader';

export const metadata: Metadata = {
  title: 'Build planner',
  description:
    'Pick the Warframe weapon you want and Forgeline lists every weapon needed down the whole chain, what you already have, and what is left to build or get.',
};

export default function PlanPage() {
  return (
    <>
      <ScreenHeader
        title="Foundry"
        context="Pick a weapon to build: every weapon down the chain, what is left once your arsenal is counted, and what it costs."
      />
      <BuildPlanner />
    </>
  );
}
