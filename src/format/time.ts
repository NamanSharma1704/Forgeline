/** Foundry times as the pages say them. Plain functions, usable from server and client code. */

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const tidy = (n: number) => Number(n.toFixed(1));

/** One build's time: "12 h", "1 min". */
export const shortTime = (seconds: number) =>
  seconds < 3600 ? `${Math.max(1, Math.round(seconds / 60))} min` : `${tidy(seconds / 3600)} h`;

/** A plan's total: "48 hours (2 days)". */
export function longTime(seconds: number) {
  if (seconds < 3600) {
    const minutes = Math.max(1, Math.round(seconds / 60));
    return `${minutes} ${plural(minutes, 'minute', 'minutes')}`;
  }
  const hours = tidy(seconds / 3600);
  const days = tidy(seconds / 86400);
  return hours >= 24
    ? `${hours} hours (${days} ${plural(days, 'day', 'days')})`
    : `${hours} ${plural(hours, 'hour', 'hours')}`;
}
