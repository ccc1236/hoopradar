/** When a player last appeared. `old` drives the radar card's line. */
export interface LastPlayed {
  /** nba.com GAME_DATE, e.g. "2026-10-12T00:00:00". */
  date: string;
  daysAgo: number;
  /** His latest team's games dated after his last game. */
  teamGamesSince: number;
  old: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function lastPlayedText(lp: LastPlayed): string {
  // Read the calendar date from the string so the day never shifts by timezone.
  const [, month = "1", day = "1"] = lp.date.slice(0, 10).split("-");
  const weeks = Math.floor(lp.daysAgo / 7);
  const [count, unit] = weeks >= 1 ? [weeks, "week"] : [lp.daysAgo, "day"];
  return `Last played ${MONTHS[Number(month) - 1]} ${Number(day)} (${count} ${unit}${count === 1 ? "" : "s"} ago)`;
}
