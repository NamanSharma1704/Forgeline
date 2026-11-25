'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/arsenal/', label: 'Arsenal' },
  { href: '/sweep/', label: 'Sweep' },
  { href: '/plan/', label: 'Plan' },
  { href: '/ingredients/', label: 'Ingredients' },
] as const;

/**
 * The command bar's tabs, with the current page marked (aria-current), so the lit underside shows
 * where the player is. Static pages render it at build time for their own path.
 */
export function NavLinks() {
  const path = usePathname() ?? '';
  const here = path.endsWith('/') ? path : `${path}/`;
  return (
    <>
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} aria-current={here.startsWith(link.href) ? 'page' : undefined}>
          {link.label}
        </Link>
      ))}
    </>
  );
}
