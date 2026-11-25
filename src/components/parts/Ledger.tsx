/**
 * The ledger (design plan 11.3): the one way facts are shown. Capitals label on the left, the value
 * in the telemetry face on the right, a hairline between rows.
 */
export interface LedgerRow {
  readonly label: string;
  readonly value: React.ReactNode;
  /** Gold for Orokin values, such as a mastery rank. */
  readonly tone?: 'gold';
}

export function Ledger({ rows, className }: { rows: readonly LedgerRow[]; className?: string }) {
  return (
    <dl className={className ? `ledger ${className}` : 'ledger'}>
      {rows.map((row) => (
        <div key={row.label} className="ledger__row">
          <dt>{row.label}</dt>
          <dd data-tone={row.tone}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
