import type { PerModeKey, PlayerStatRow } from "../shared/types.js";
import type { LastPlayed } from "../shared/lastPlayed.js";
import type { GameLogRow } from "./nbaGameLogs.js";

const OLD_AFTER_DAYS = 14;
const OLD_AFTER_TEAM_GAMES = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

/** One player in one game: Base stats plus Advanced USG_PCT and POSS. */
export type PlayerGame = GameLogRow;

const COUNTING = ["PTS", "REB", "AST", "STL", "BLK", "FG3M", "TOV", "FGM", "FGA", "FTM", "FTA"] as const;

export function joinGameLogs(base: GameLogRow[], adv: GameLogRow[]): PlayerGame[] {
  const advByKey = new Map(adv.map((r) => [`${r.playerId}:${r.gameId}`, r.stats]));
  return base.map((r) => {
    const a = advByKey.get(`${r.playerId}:${r.gameId}`);
    return { ...r, stats: { ...r.stats, USG_PCT: a?.USG_PCT ?? null, POSS: a?.POSS ?? null } };
  });
}

/** Newest first by GAME_DATE, then GAME_ID. */
function newestFirst(a: PlayerGame, b: PlayerGame): number {
  return b.gameDate.localeCompare(a.gameDate) || b.gameId.localeCompare(a.gameId);
}

function byPlayer(games: readonly PlayerGame[]): Map<number, PlayerGame[]> {
  const out = new Map<number, PlayerGame[]>();
  for (const g of games) {
    const list = out.get(g.playerId);
    if (list) list.push(g);
    else out.set(g.playerId, [g]);
  }
  for (const list of out.values()) list.sort(newestFirst);
  return out;
}

const ratio = (num: number, den: number): number | null => (den > 0 ? num / den : null);

function windowRow(games: PlayerGame[], perMode: PerModeKey): PlayerStatRow {
  const sum = (key: string): number => games.reduce((t, g) => t + (g.stats[key] ?? 0), 0);
  const gp = games.length;
  const totalMin = sum("MIN");
  const mpg = totalMin / gp;

  const stats: Record<string, number | null> = { GP: gp, ADV_GP: gp, MIN: mpg, ADV_MIN: mpg };
  for (const key of COUNTING) {
    stats[key] = perMode === "Per36" ? (totalMin > 0 ? (sum(key) / totalMin) * 36 : null) : sum(key) / gp;
  }

  // Percentages come from totals, or a 1-for-1 night counts as much as 10-for-20.
  const [pts, fgm, fga, fg3m, ftm, fta] = ["PTS", "FGM", "FGA", "FG3M", "FTM", "FTA"].map(sum) as [number, number, number, number, number, number];
  stats.FG_PCT = ratio(fgm, fga);
  stats.FT_PCT = ratio(ftm, fta);
  stats.EFG_PCT = ratio(fgm + 0.5 * fg3m, fga);
  stats.TS_PCT = ratio(pts, 2 * (fga + 0.44 * fta));
  // USG% has no totals to rebuild from, so weight each game by its possessions.
  stats.USG_PCT = ratio(
    games.reduce((t, g) => t + (g.stats.USG_PCT ?? 0) * (g.stats.POSS ?? 0), 0),
    sum("POSS"),
  );

  const latest = games[0]!;
  return { nbaId: latest.playerId, name: latest.name, teamAbbr: latest.team, position: null, stats };
}

/** One row per player from his own newest `n` games, however long ago those were. */
export function buildOwnWindowRows(games: readonly PlayerGame[], n: number, perMode: PerModeKey): PlayerStatRow[] {
  return Array.from(byPlayer(games).values(), (list) => windowRow(list.slice(0, n), perMode));
}

/** Whole calendar days between a GAME_DATE and `now`, so the time of day never matters. */
function daysSince(gameDate: string, now: number): number {
  const [y = 0, m = 1, d = 1] = gameDate.slice(0, 10).split("-").map(Number);
  const today = new Date(now);
  return Math.round((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(y, m - 1, d)) / DAY_MS);
}

export function buildLastPlayed(games: readonly PlayerGame[], now: number): Record<number, LastPlayed> {
  const teamGames = new Map<string, Map<string, string>>();
  for (const g of games) {
    const seen = teamGames.get(g.team) ?? new Map<string, string>();
    seen.set(g.gameId, g.gameDate);
    teamGames.set(g.team, seen);
  }

  const out: Record<number, LastPlayed> = {};
  for (const [playerId, list] of byPlayer(games)) {
    const last = list[0]!;
    const daysAgo = daysSince(last.gameDate, now);
    let teamGamesSince = 0;
    for (const date of teamGames.get(last.team)?.values() ?? []) {
      if (date > last.gameDate) teamGamesSince++;
    }
    out[playerId] = {
      date: last.gameDate,
      daysAgo,
      teamGamesSince,
      old: daysAgo > OLD_AFTER_DAYS || teamGamesSince >= OLD_AFTER_TEAM_GAMES,
    };
  }
  return out;
}
