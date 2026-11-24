'use client';

import { usePathname } from 'next/navigation';
import { WeaponSearch } from './WeaponSearch';

/** The compact header search, everywhere except the home page, whose large search is the page. */
export function HeaderSearch() {
  const pathname = usePathname();
  if (pathname === '/') return null;
  return <WeaponSearch variant="compact" />;
}
