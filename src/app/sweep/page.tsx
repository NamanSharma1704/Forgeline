import type { Metadata } from 'next';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { SlotSweep } from '@/components/SlotSweep';
import { shareMetadata } from '@/data/site';

const title = 'Slot sweep';
const description =
  'Out of weapon slots? Forgeline sorts the Warframe weapons you hold into safe to sell and keep, with the reason for each.';

export const metadata: Metadata = {
  title,
  description,
  ...shareMetadata({ title, description, path: '/sweep/' }),
};

export default function SweepPage() {
  return (
    <>
      <ScreenHeader
        title="Slot Sweep"
        context="Out of slots? What you hold, sorted into what can go and what must stay."
      />
      <SlotSweep />
    </>
  );
}
