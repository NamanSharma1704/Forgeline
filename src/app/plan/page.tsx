import type { Metadata } from 'next';
import { BuildPlanner } from '@/components/BuildPlanner';

export const metadata: Metadata = {
  title: 'Build planner',
  description:
    'Pick the Warframe weapon you want and Forgeline lists every weapon needed down the whole chain, what you already have, and what is left to build or get.',
};

export default function PlanPage() {
  return (
    <>
      <h1 className="page-title">Build planner</h1>
      <p className="lede">
        Pick a weapon you want. Forgeline lists every weapon that goes into it, down the whole chain,
        and what is left to build or get once the weapons in your arsenal are counted.
      </p>
      <BuildPlanner />
    </>
  );
}
