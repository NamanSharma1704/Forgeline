import type { Metadata } from 'next';
import { SlotSweep } from '@/components/SlotSweep';

export const metadata: Metadata = {
  title: 'Slot sweep',
  description:
    'Out of weapon slots? Forgeline sorts the Warframe weapons you hold into safe to sell and keep, with the reason for each.',
};

export default function SweepPage() {
  return (
    <>
      <h1 className="page-title">Out of slots?</h1>
      <SlotSweep />
    </>
  );
}
