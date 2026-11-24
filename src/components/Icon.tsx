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
