import { describe, expect, it, vi } from "vitest";
import { createOwnWindowsStore } from "../../src/background/ownWindowsStore.js";
import { RateLimitedError, UpstreamUnavailableError } from "../../src/background/nbaClient.js";
import type { GameLogRow } from "../../src/background/nbaGameLogs.js";

const HOUR = 60 * 60 * 1000;
const T0 = new Date("2026-11-07T12:00:00").getTime();

function row(playerId: number, gameId: string, day: string, stats: Record<string, number | null>): GameLogRow {
  return { playerId, name: `P${playerId}`, team: "HOU", gameId, gameDate: `${day}T00:00:00`, stats };
}
const BASE = [1, 2, 3, 4, 5, 6].map((d) => row(1, `g${d}`, `2026-11-0${d}`, { MIN: 30, PTS: d, FGM: 1, FGA: 2, FG3M: 0, FTM: 0, FTA: 0 }));
const ADV = BASE.map((r) => ({ ...r, stats: { USG_PCT: 0.2, POSS: 60 } }));

function setup(opts: { base?: GameLogRow[]; adv?: GameLogRow[] } = {}) {
  const mem = new Map<string, unknown>();
  const cache = {
    get: async <T>(k: string) => (mem.has(k) ? (mem.get(k) as T) : null),
    set: async <T>(k: string, v: T) => void mem.set(k, v),
  };
  const fetchLogs = vi.fn(async (_s: string, m: "Base" | "Advanced") => (m === "Base" ? opts.base ?? BASE : opts.adv ?? ADV));
  const onBlocked = vi.fn();
  let t = T0;
  const store = createOwnWindowsStore({ cache, fetchLogs, onBlocked, now: () => t });
  return { store, fetchLogs, onBlocked, mem, advance: (ms: number) => (t += ms) };
}

describe("ownWindowsStore", () => {
  it("downloads Base and Advanced once on a cold store", async () => {
    const { store, fetchLogs } = setup();
    const r = await store.getRows("2026-27", 5, "PerGame");
    expect(fetchLogs.mock.calls.map((c) => c[1]).sort()).toEqual(["Advanced", "Base"]);
    expect(r.staleSince).toBeNull();
    expect(r.rows[0]!.stats.GP).toBe(5);
    expect(r.rows[0]!.stats.PTS).toBe((2 + 3 + 4 + 5 + 6) / 5);
  });

  it("serves every window and Per mode from one download", async () => {
    const { store, fetchLogs } = setup();
    await store.getRows("2026-27", 5, "PerGame");
    const l10 = await store.getRows("2026-27", 10, "Per36");
    expect(l10.rows[0]!.stats.GP).toBe(6);
    expect(fetchLogs).toHaveBeenCalledTimes(2);
  });

  it("shares one download between concurrent callers", async () => {
    const { store, fetchLogs } = setup();
    await Promise.all([store.getRows("2026-27", 5, "PerGame"), store.getRows("2026-27", 10, "PerGame"), store.getRows("2026-27", 5, "Per36")]);
    expect(fetchLogs).toHaveBeenCalledTimes(2);
  });

  it("downloads again when forced", async () => {
    const { store, fetchLogs } = setup();
    await store.getRows("2026-27", 5, "PerGame");
    await store.getRows("2026-27", 5, "PerGame", true);
    expect(fetchLogs).toHaveBeenCalledTimes(4);
  });

  it("keeps using saved rows for 6 hours, then downloads again", async () => {
    const { store, fetchLogs, advance } = setup();
    await store.getRows("2026-27", 5, "PerGame");
    advance(6 * HOUR - 1);
    await store.getRows("2026-27", 5, "PerGame");
    expect(fetchLogs).toHaveBeenCalledTimes(2);
    advance(2);
    await store.getRows("2026-27", 5, "PerGame");
    expect(fetchLogs).toHaveBeenCalledTimes(4);
  });

  it("falls back to saved rows when a later download fails, saying how old they are", async () => {
    const { store, fetchLogs, advance } = setup();
    await store.getRows("2026-27", 5, "PerGame");
    advance(30 * 24 * HOUR);
    fetchLogs.mockRejectedValue(new UpstreamUnavailableError(500));
    const r = await store.getRows("2026-27", 5, "PerGame");
    expect(r.staleSince).toBe(T0);
    expect(r.rows[0]!.stats.GP).toBe(5);
  });

  it("rethrows when a download fails with nothing saved", async () => {
    const { store, fetchLogs } = setup();
    fetchLogs.mockRejectedValue(new UpstreamUnavailableError(500));
    await expect(store.getRows("2026-27", 5, "PerGame")).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });

  it("reports rate limiting once so the cooldown applies", async () => {
    const { store, fetchLogs, onBlocked } = setup();
    fetchLogs.mockRejectedValue(new RateLimitedError());
    await expect(store.getRows("2026-27", 5, "PerGame")).rejects.toBeInstanceOf(RateLimitedError);
    expect(onBlocked).toHaveBeenCalledTimes(1);
  });

  it("treats only one measure having rows as a failure", async () => {
    const { store } = setup({ adv: [] });
    await expect(store.getRows("2026-27", 5, "PerGame")).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });

  it("returns no rows and no error before the season starts", async () => {
    const { store } = setup({ base: [], adv: [] });
    expect(await store.getRows("2026-27", 5, "PerGame")).toEqual({ rows: [], staleSince: null });
  });

  it("does not repeat an empty download within the hour, then checks again", async () => {
    const { store, fetchLogs, advance } = setup({ base: [], adv: [] });
    await store.getRows("2026-27", 5, "PerGame");
    await store.getRows("2026-27", 5, "PerGame");
    expect(fetchLogs).toHaveBeenCalledTimes(2);
    advance(HOUR + 1);
    await store.getRows("2026-27", 5, "PerGame");
    expect(fetchLogs).toHaveBeenCalledTimes(4);
  });

  it("does not overwrite saved rows with an empty download", async () => {
    const { store, fetchLogs, advance } = setup();
    await store.getRows("2026-27", 5, "PerGame");
    advance(7 * HOUR);
    fetchLogs.mockResolvedValue([]);
    const r = await store.getRows("2026-27", 5, "PerGame");
    expect(r.rows[0]!.stats.GP).toBe(5);
  });

  it("uses a cache key apart from the old LastNGames entries", async () => {
    const { store, mem } = setup();
    await store.getRows("2026-27", 5, "PerGame");
    expect([...mem.keys()]).toEqual(["own:v1:2026-27"]);
  });

  it("returns last played for a known player, without downloading", async () => {
    const { store, fetchLogs } = setup();
    expect(await store.getLastPlayed("2026-27", 1)).toBeNull();
    expect(fetchLogs).not.toHaveBeenCalled();
    await store.getRows("2026-27", 5, "PerGame");
    expect((await store.getLastPlayed("2026-27", 1))!.date).toBe("2026-11-06T00:00:00");
    expect(await store.getLastPlayed("2026-27", 999)).toBeNull();
  });
});
