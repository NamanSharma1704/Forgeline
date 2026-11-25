/**
 * Forgeline's icon set: one stroke weight, one corner style, drawn here rather than borrowed from
 * glyphs or emoji, so every icon sits on the same 24 px grid and inherits `currentColor`.
 */

const PATHS = {
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5.5 5.5" />
    </>
  ),
  // Verdicts. Each is paired with its word and colour, never shown alone.
  safe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.25 12.25l2.6 2.6 4.9-5.35" />
    </>
  ),
  check: (
    <>
      <path d="M12 3.75L21.25 19.5H2.75z" />
      <path d="M12 9.75v4.25" />
      <path d="M12 16.9v.2" />
    </>
  ),
  keep: (
    <>
      <path d="M12 3.25l7.25 3v5.6c0 4.3-3 7.6-7.25 8.9-4.25-1.3-7.25-4.6-7.25-8.9v-5.6z" />
      <path d="M9 11.75l2.25 2.25L15.25 10" />
    </>
  ),
  copy: (
    <>
      <path d="M9 9h10v10H9z" />
      <path d="M15 9V5H5v10h4" />
    </>
  ),
  done: <path d="M5 12.5l4.25 4.25L19 7" />,
  // Home page tools (design plan 3.4): a blueprint sheet, inventory slots, a Foundry queue.
  blueprint: (
    <>
      <path d="M5 4.5h11l3 3v12H5z" />
      <path d="M8.5 10h7M8.5 13.5h7M8.5 17h4" />
    </>
  ),
  slots: (
    <>
      <path d="M4.5 4.5h6.5v6.5H4.5zM13 4.5h6.5v6.5H13zM4.5 13h6.5v6.5H4.5z" />
      <path d="M13 13h6.5v6.5H13z" strokeDasharray="2 2" />
    </>
  ),
  queue: (
    <>
      <path d="M4.5 6h15M4.5 12h11M4.5 18h7" />
      <path d="M17.5 15.5l2.5 2.5-2.5 2.5" />
    </>
  ),
  // Leaves the site: opens another site in a new tab.
  external: <path d="M13.5 5.5h5v5M18.5 5.5l-7.5 7.5M16.5 13.5v5h-11v-11h5" />,
  // Foundry time.
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  // Incarnon: a cut crystal, for weapons that can take an Incarnon Genesis.
  incarnon: (
    <>
      <path d="M12 3.25l6.75 8.75L12 20.75 5.25 12z" />
      <path d="M5.25 12h13.5M12 3.25v17.5" />
    </>
  ),
  // Favourite: filled by CSS when the toggle is on.
  star: <path d="M12 3.6l2.6 5.28 5.83.85-4.22 4.11 1 5.8L12 16.9l-5.21 2.74 1-5.8-4.22-4.11 5.83-.85z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <path d="M12 7.9v.2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="3.75" />
      <path d="M12 3v1.75M12 19.25V21M3 12h1.75M19.25 12H21M5.6 5.6l1.25 1.25M17.15 17.15l1.25 1.25M5.6 18.4l1.25-1.25M17.15 6.85l1.25-1.25" />
    </>
  ),
  moon: <path d="M19.5 14.6A7.75 7.75 0 0 1 9.4 4.5a7.75 7.75 0 1 0 10.1 10.1z" />,
  'arrow-right': <path d="M4.5 12h14M13.5 7l5 5-5 5" />,
  'arrow-down': <path d="M12 4.5v14M7 13.5l5 5 5-5" />,
  'chevron-down': <path d="M7 10l5 5 5-5" />,
  // Slots (design plan 3.5): slots are told apart by these shapes, never by colour.
  primary: <path d="M2.5 13l1.75-2.75h10.5L16 9h5.5v2.5h-3.25l-1 1h-4.5l-1.5 3.5H8.5l.75-3z" />,
  secondary: (
    <>
      <path d="M4.5 7.75h15v3.5H11l-.75 1v5.5h-4l-.75-5.5-1-1z" />
      <path d="M10.25 13.75h2.25v-2.5" />
    </>
  ),
  melee: (
    <>
      <path d="M19.25 4.75l-1 3.5-8 8-2.5-2.5 8-8z" />
      <path d="M6.25 12.25l5.5 5.5M8.25 15.75l-3.5 3.5" />
    </>
  ),
  'arch-gun': (
    <>
      <path d="M2.75 9.75h13.5l1.5-1.5h3.5v5h-3.25l-1 1.25H2.75z" />
      <path d="M9.5 14.5v3.25h3.5V14.5" />
    </>
  ),
  'arch-melee': (
    <>
      <path d="M19.75 4.25l-.75 5.5-8.25 8.25-4.75-4.75 8.25-8.25z" />
      <path d="M4.75 11.75l7.5 7.5M7.75 16.25l-3.5 3.5" />
    </>
  ),
  companion: (
    <>
      <path d="M12 8.25l3.75 3.75L12 15.75 8.25 12z" />
      <path d="M8.25 12h-4.5l1.75-3M15.75 12h4.5l-1.75-3M12 15.75v3.5" />
    </>
  ),
  // Mastered: a wreath of our own drawing, with an Orokin diamond at its head.
  laurel: (
    <>
      <path d="M10.25 19.5C6.5 18.5 4 15.25 4.25 10.5M13.75 19.5c3.75-1 6.25-4.25 6-9" />
      <path d="M4.6 13.5l2.4-1.1M5.6 16.4l2.3-1.4M7.6 18.6l1.9-1.8M4.3 10.6l2.2-.4M19.4 13.5l-2.4-1.1M18.4 16.4l-2.3-1.4M16.4 18.6l-1.9-1.8M19.7 10.6l-2.2-.4" />
      <path d="M12 4.25l1.75 1.75L12 7.75 10.25 6z" />
    </>
  ),
  // Nodes, markers and rule ends.
  diamond: <path d="M12 4.5l7.5 7.5-7.5 7.5L4.5 12z" />,
  // Credits: a stack of coins (a lettered coin reads as the copyright sign).
  credits: (
    <>
      <ellipse cx="12" cy="7.5" rx="6.5" ry="2.75" />
      <path d="M5.5 7.5V12c0 1.5 2.9 2.75 6.5 2.75s6.5-1.25 6.5-2.75V7.5M5.5 12v4.5c0 1.5 2.9 2.75 6.5 2.75s6.5-1.25 6.5-2.75V12" />
    </>
  ),
  sell: (
    <>
      <path d="M3.75 12.5V4.75h7.75l8.75 8.75-7.75 7.75z" />
      <circle cx="8.25" cy="9.25" r="1.25" />
    </>
  ),
  back: <path d="M10 6.5L4.5 12l5.5 5.5M4.75 12h14.75" />,
  // View switches: tiles, and rows.
  grid: <path d="M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z" />,
  list: <path d="M9.5 6.5h10M9.5 12h10M9.5 17.5h10M4.75 6.5h.5M4.75 12h.5M4.75 17.5h.5" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  minus: <path d="M6 12h12" />,
  plus: <path d="M12 6v12M6 12h12" />,
  download: <path d="M12 4.5v10.5M7.5 10.5l4.5 4.5 4.5-4.5M5 19.5h14" />,
  upload: <path d="M12 15V4.5M7.5 9l4.5-4.5L16.5 9M5 19.5h14" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  className,
  size = 24,
  label,
}: {
  name: IconName;
  className?: string;
  size?: number;
  /** Give a label only when the icon is the sole content of its control. */
  label?: string;
}) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
