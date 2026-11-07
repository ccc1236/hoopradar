import type { PerModeKey, PlayerStatRow } from "../shared/types.js";
import type { LastPlayed } from "../shared/lastPlayed.js";
import { PER_MODES } from "../shared/perModes.js";
import { WINDOWS } from "../shared/windows.js";
import { RateLimitedError, UpstreamUnavailableError } from "./nbaClient.js";
import type { GameLogRow } from "./nbaGameLogs.js";
import { buildLastPlayed, buildOwnWindowRows, joinGameLogs } from "./ownWindows.js";

const FRESH_MS = 6 * 60 * 60 * 1000;
/** Before the season starts the logs are empty; recheck hourly so opening night is picked up. */
const EMPTY_FRESH_MS = 60 * 60 * 1000;
/** Saved rows have no age limit, and the cache deletes on expiry, so freshness is judged here. */
const KEEP_MS = 10 * 365 * 24 * 60 * 60 * 1000;

export interface OwnWindowsResult {
  rows: PlayerStatRow[];
  /** When the rows were downloaded, if a newer download failed. Null when current. */
  staleSince: number | null;
}

export interface OwnWindowsStore {
  getRows(season: string, n: number, perMode: PerModeKey, forceFresh?: boolean): Promise<OwnWindowsResult>;
  getLastPlayed(season: string, nbaId: number): Promise<LastPlayed | null>;
}

export interface OwnWindowsStoreDeps {
  cache: {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
  };
  fetchLogs: (season: string, measure: "Base" | "Advanced") => Promise<GameLogRow[]>;
  /** nba.com refused us (403/429): trigger the throttle cooldown. */
  onBlocked: () => void;
  now?: () => number;
}

interface Saved {
  fetchedAt: number;
  rows: Record<string, PlayerStatRow[]>;
  lastPlayed: Record<number, LastPlayed>;
}

const slot = (n: number, perMode: PerModeKey): string => `${n}:${perMode}`;
const isEmpty = (s: Saved): boolean => Object.keys(s.rows).length === 0;

/**
 * L5/L10 as each player's own last games, calculated from one league-wide game
 * log download. Keys start "own:" so they never collide with the "lps:"
 * LastNGames entries: a rollback to an older version refetches instead of
 * showing these rows under team-window logic.
 */
export function createOwnWindowsStore(deps: OwnWindowsStoreDeps): OwnWindowsStore {
  const now = deps.now ?? Date.now;
  const inFlight = new Map<string, Promise<Saved>>();
  const keyFor = (season: string): string => `own:v1:${season}`;

  async function download(season: string, saved: Saved | null): Promise<Saved> {
    const [base, adv] = await Promise.all([deps.fetchLogs(season, "Base"), deps.fetchLogs(season, "Advanced")]);
    // One measure with rows and not the other is a broken response, not an empty season.
    if ((base.length === 0) !== (adv.length === 0)) throw new UpstreamUnavailableError(200);
    if (base.length === 0) {
      if (saved && !isEmpty(saved)) return saved;
      const empty: Saved = { fetchedAt: now(), rows: {}, lastPlayed: {} };
      await deps.cache.set(keyFor(season), empty, KEEP_MS);
      return empty;
    }
    const games = joinGameLogs(base, adv);
    const rows: Saved["rows"] = {};
    for (const w of WINDOWS) {
      if (w.lastNGames === 0) continue;
      for (const m of PER_MODES) rows[slot(w.lastNGames, m.key)] = buildOwnWindowRows(games, w.lastNGames, m.key);
    }
    const next: Saved = { fetchedAt: now(), rows, lastPlayed: buildLastPlayed(games, now()) };
    await deps.cache.set(keyFor(season), next, KEEP_MS);
    return next;
  }

  /** Concurrent callers (table plus radar card) share one download. */
  function shared(season: string, saved: Saved | null): Promise<Saved> {
    const running = inFlight.get(season);
    if (running) return running;
    const p = download(season, saved).finally(() => inFlight.delete(season));
    inFlight.set(season, p);
    return p;
  }

  return {
    async getRows(season, n, perMode, forceFresh) {
      const saved = await deps.cache.get<Saved>(keyFor(season));
      const lifetime = saved && isEmpty(saved) ? EMPTY_FRESH_MS : FRESH_MS;
      if (saved && !forceFresh && now() - saved.fetchedAt <= lifetime) {
        return { rows: saved.rows[slot(n, perMode)] ?? [], staleSince: null };
      }
      try {
        const fresh = await shared(season, saved);
        return { rows: fresh.rows[slot(n, perMode)] ?? [], staleSince: null };
      } catch (e) {
        if (e instanceof RateLimitedError) deps.onBlocked();
        if (saved && !isEmpty(saved)) return { rows: saved.rows[slot(n, perMode)] ?? [], staleSince: saved.fetchedAt };
        throw e;
      }
    },

    async getLastPlayed(season, nbaId) {
      const saved = await deps.cache.get<Saved>(keyFor(season));
      return saved?.lastPlayed[nbaId] ?? null;
    },
  };
}
