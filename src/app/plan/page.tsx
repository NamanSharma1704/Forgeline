import type { Metadata } from 'next';
import { BuildPlanner } from '@/components/BuildPlanner';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { shareMetadata } from '@/data/site';

const title = 'Build planner';
const description =
  'Pick the Warframe weapon you want and Forgeline lists every weapon needed down the whole chain, what you already have, and what is left to build or get.';

export const metadata: Metadata = {
  title,
  description,
  ...shareMetadata({ title, description, path: '/plan/' }),
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
