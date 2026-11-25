/**
 * A screen's header (design plan 4.1): its title in tracked capitals, one line of context, and the
 * screen's own figure on the right. Behind it, the one texture on the site: a faint Orokin
 * linework of arches and a diamond (3.4), drawn here, static, and hidden from assistive technology.
 */
export function ScreenHeader({
  title,
  context,
  telemetry,
}: {
  title: string;
  context?: React.ReactNode;
  /** The screen's own figure, such as "Freeable 12". */
  telemetry?: React.ReactNode;
}) {
  return (
    <header className="screen-header">
      <svg className="screen-header__linework" viewBox="0 0 360 120" aria-hidden="true" focusable="false">
        <path d="M60 120a120 120 0 0 1 240 0M100 120a80 80 0 0 1 160 0M140 120a40 40 0 0 1 80 0" />
        <path d="M180 0v120M0 120h360M24 120l60-60M336 120l-60-60" />
        <path d="M180 22l10 10-10 10-10-10z" />
      </svg>
      <div className="screen-header__main">
        <h1 className="screen-header__title">{title}</h1>
        {context && <p className="screen-header__context">{context}</p>}
      </div>
      {telemetry && <div className="screen-header__telemetry">{telemetry}</div>}
    </header>
  );
}

/** A figure for the header's right side: a small capitals label over a telemetry value. */
export function Telemetry({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p className="telemetry-figure">
      <span className="telemetry-figure__label">{label}</span>
      <span className="telemetry-figure__value">{value}</span>
    </p>
  );
}
