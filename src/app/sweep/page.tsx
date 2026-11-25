import type { Metadata } from 'next';
import { FreeableTelemetry } from '@/components/HomeArsenalStats';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { SlotSweep } from '@/components/SlotSweep';

export const metadata: Metadata = {
  title: 'Slot sweep',
  description:
    'Out of weapon slots? Forgeline sorts the Warframe weapons you hold into safe to sell and keep, with the reason for each.',
};

export default function SweepPage() {
  return (
    <>
      <ScreenHeader
        title="Slot Sweep"
        context="Out of slots? What you hold, sorted into what can go and what must stay."
        telemetry={<FreeableTelemetry />}
      />
      <SlotSweep />
    </>
  );
}
