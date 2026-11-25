'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../Icon';
import { openSearchOverlay } from './search-bus';
import { isCurrent, SEGMENTS } from './segments';

/**
 * Phones (design plan 4.6): search and the four screens in a fixed bar along the bottom, icon over
 * label, so every screen stays one thumb tap away. Hidden from tablet width up, where the Orbiter
 * bar carries them.
 */
export function BottomBar() {
  const path = usePathname() ?? '/';
  return (
    <nav className="bottom-bar" aria-label="Screens">
      <button type="button" className="bottom-bar__item" onClick={openSearchOverlay}>
        <Icon name="search" size={22} />
        <span>Search</span>
      </button>
      {SEGMENTS.map((segment) => (
        <Link
          key={segment.href}
          href={segment.href}
          className="bottom-bar__item"
          aria-current={isCurrent(path, segment.href) ? 'page' : undefined}
        >
          <Icon name={segment.icon} size={22} />
          <span>{segment.label}</span>
        </Link>
      ))}
    </nav>
  );
}
