/** The emblem: the app icon's glyph, two ingredients joining into what they build. */
export function Emblem({ size = 20 }: { size?: number }) {
  return (
    <svg
      className="wordmark__emblem"
      width={size}
      height={size}
      viewBox="128 144 256 224"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="128" y="144" width="72" height="72" fill="currentColor" />
      <rect x="128" y="296" width="72" height="72" fill="currentColor" />
      <path d="M200 180 H244 V332 H200 M244 256 H290" fill="none" stroke="currentColor" strokeWidth="16" />
      <polygon points="314,206 384,206 384,282 360,306 290,306 290,230" fill="currentColor" />
    </svg>
  );
}
