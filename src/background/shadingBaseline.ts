import type { PlayerStatRow, YahooPlayerId } from "../shared/types.js";
import { SHADED_KEYS, type SampleInfo, type ShadingBaseline, type ShadingPayload } from "../shared/shading.js";

export const SMALL_GP_SHARE = 0.25;
export const SMALL_MPG = 8;
export const MIN_BASELINE_PLAYERS = 20;

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * Small sample = fewer than 25% of the team's games in the window, OR under
 * 8 minutes per game in the games played. Uses the merge's ADV_GP / ADV_MIN:
 * Advanced MIN is already minutes per game and, unlike Base MIN, stays the
 * same in every PerMode (verified against live 2026-27 data), so the verdict
 * is the same in every PerMode.
 */
export function sampleInfoFor(row: PlayerStatRow, teamGames: number): SampleInfo {
  const gp = num(row.stats.ADV_GP);
  const mpg = gp > 0 ? num(row.stats.ADV_MIN) : 0;
  return { small: gp < SMALL_GP_SHARE * teamGames || mpg < SMALL_MPG, gp, teamGames, mpg };
}

/**
 * Baseline (mean, population SD) for each shaded stat over the window's
 * non-small-sample rows, plus sample info for each requested Yahoo player.
 * Team games are the highest ADV_GP among a team's rows: nba.com's player
 * dashboard has no team game count.
 */
export function buildShadingPayload(
  leagueRows: readonly PlayerStatRow[],
  byYahooId: Record<YahooPlayerId, PlayerStatRow | null>,
): ShadingPayload {
  const teamGames = new Map<string, number>();
  for (const row of leagueRows) {
    teamGames.set(row.teamAbbr, Math.max(teamGames.get(row.teamAbbr) ?? 0, num(row.stats.ADV_GP)));
  }
  const infoOf = (row: PlayerStatRow): SampleInfo => sampleInfoFor(row, teamGames.get(row.teamAbbr) ?? 0);

  const established = leagueRows.filter((row) => !infoOf(row).small);
  const baseline: ShadingBaseline = {};
  for (const key of SHADED_KEYS) {
    const values = established
      .map((row) => row.stats[key])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (values.length < MIN_BASELINE_PLAYERS) {
      baseline[key] = null;
      continue;
    }
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
    baseline[key] = sd > 0 ? { mean, sd } : null;
  }

  const sampleByYahooId: Record<YahooPlayerId, SampleInfo | null> = {};
  for (const [yahooId, row] of Object.entries(byYahooId)) {
    sampleByYahooId[yahooId] = row ? infoOf(row) : null;
  }
  return { baseline, sampleByYahooId };
}
