'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { tally } from '@/store/arsenal';
import { useArsenal } from '@/store/useArsenal';
import { Icon } from '../Icon';
import { ThemeToggle } from '../ThemeToggle';
import { Emblem } from './Emblem';
import { openSearchOverlay } from './search-bus';
import { isCurrent, screenOf, SEGMENTS } from './segments';

/**
 * The player's mastery, as the game's profile strip shows it. Read from this browser, so it is held
 * invisible (same text, same width) until the arsenal has loaded: no jump, no wrong number.
 */
function MasteryReadout({ total }: { total: number }) {
  const { ready, arsenal } = useArsenal();
  const mastered = ready ? tally(arsenal).masteryDone : 0;
  return (
    <Link href="/arsenal/" className="readout" data-ready={ready ? '' : undefined} title="Your mastery, from My Arsenal">
      <span className="readout__label">Mastered</span>
      <span className="readout__value">
        {mastered}/{total}
      </span>
    </Link>
  );
}

/**
 * The Orbiter bar (design plan 4.3): emblem and the current screen's title on the left, the four
 * screens in the middle with the current one in gold, and the player's mastery, search and theme
 * on the right. On phones it shrinks to the emblem, the screen title and the theme switch; the
 * screens and search move to the bottom bar (4.6).
 */
export function OrbiterBar({ weaponCount }: { weaponCount: number }) {
  const path = usePathname() ?? '/';
  return (
    <header className="orbiter-bar">
      <div className="container orbiter-bar__inner">
        <div className="orbiter-bar__id">
          <Link href="/" className="wordmark">
            <Emblem />
            <span className="wordmark__name">Forgeline</span>
          </Link>
          <span className="orbiter-bar__screen">{screenOf(path)}</span>
        </div>

        <nav className="segment-tabs" aria-label="Screens">
          {SEGMENTS.map((segment) => (
            <Link
              key={segment.href}
              href={segment.href}
              className="segment-tab"
              aria-current={isCurrent(path, segment.href) ? 'page' : undefined}
            >
              {segment.label}
            </Link>
          ))}
        </nav>

        <div className="orbiter-bar__tools">
          <MasteryReadout total={weaponCount} />
          <button
            type="button"
            className="search-trigger"
            onClick={openSearchOverlay}
            aria-keyshortcuts="/ Control+K"
            aria-label="Search weapons"
          >
            <Icon name="search" size={16} />
            <span className="search-trigger__label">Search</span>
            <kbd className="keycap">/</kbd>
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
