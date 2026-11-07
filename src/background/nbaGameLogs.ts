import { RateLimitedError, UpstreamUnavailableError } from "./nbaClient.js";
import { log } from "../shared/logger.js";

const BASE_URL = "https://stats.nba.com/stats/playergamelogs";

const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 800;
const DEFAULT_TIMEOUT_MS = 60_000;

/** One player in one game. */
export interface GameLogRow {
  playerId: number;
  name: string;
  team: string;
  gameId: string;
  gameDate: string;
  stats: Record<string, number | null>;
}

interface RawResponse {
  resultSets?: { headers: string[]; rowSet: (string | number | null)[][] }[];
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function parse(raw: RawResponse): GameLogRow[] {
  const rs = raw.resultSets?.[0];
  if (!rs) throw new UpstreamUnavailableError(200);
  const at = (h: string): number => rs.headers.indexOf(h);
  const [iId, iName, iTeam, iGame, iDate] = ["PLAYER_ID", "PLAYER_NAME", "TEAM_ABBREVIATION", "GAME_ID", "GAME_DATE"].map(at);
  return rs.rowSet.map((row) => {
    const stats: Record<string, number | null> = {};
    rs.headers.forEach((h, i) => {
      const v = row[i];
      if (typeof v === "number" || v === null) stats[h] = v as number | null;
    });
    return {
      playerId: row[iId!] as number,
      name: String(row[iName!] ?? ""),
      team: String(row[iTeam!] ?? ""),
      gameId: String(row[iGame!] ?? ""),
      gameDate: String(row[iDate!] ?? ""),
      stats,
    };
  });
}

async function fetchOnce(url: string, timeoutMs: number): Promise<Response | RawResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    // Read the body inside the timeout: these responses run to 13 MB.
    return res.ok ? ((await res.json()) as RawResponse) : res;
  } catch (e) {
    if (controller.signal.aborted) throw new UpstreamUnavailableError(0);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch every player's game log for a season, one row per player per game.
 *
 * 5xx is retried like fetchLeagueDashPlayerStats. 403 and 429 are never
 * retried and surface as RateLimitedError so the caller's cooldown applies:
 * a block on the user's IP is the one failure a rollback cannot undo.
 */
export async function fetchPlayerGameLogs(
  season: string,
  measure: "Base" | "Advanced",
  opts: { retries?: number; retryDelayMs?: number; timeoutMs?: number } = {},
): Promise<GameLogRow[]> {
  const q = new URLSearchParams({ Season: season, SeasonType: "Regular Season", MeasureType: measure, LeagueID: "00" });
  const url = `${BASE_URL}?${q.toString()}`;
  const retries = opts.retries ?? DEFAULT_RETRIES;

  for (let attempt = 0; ; attempt++) {
    log.debug("fetch", url);
    const out = await fetchOnce(url, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    if (!(out instanceof Response)) return parse(out);
    if (out.status === 429 || out.status === 403) throw new RateLimitedError();
    if (out.status >= 500 && attempt < retries) {
      await sleep(opts.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
      continue;
    }
    throw new UpstreamUnavailableError(out.status);
  }
}
