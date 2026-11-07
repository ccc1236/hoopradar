import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPlayerGameLogs } from "../../src/background/nbaGameLogs.js";
import { RateLimitedError, UpstreamUnavailableError } from "../../src/background/nbaClient.js";

const SAMPLE = {
  resultSets: [
    {
      headers: ["PLAYER_ID", "PLAYER_NAME", "TEAM_ABBREVIATION", "GAME_ID", "GAME_DATE", "MIN", "PTS", "USG_PCT", "MATCHUP"],
      rowSet: [[7, "A Player", "SAS", "0022600001", "2026-11-04T00:00:00", 31.5, 20, null, "SAS vs. OKC"]],
    },
  ],
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("fetchPlayerGameLogs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("requests the league-wide game logs with exactly four params", async () => {
    const f = vi.fn().mockResolvedValue(json(SAMPLE));
    vi.stubGlobal("fetch", f);
    await fetchPlayerGameLogs("2026-27", "Base");
    expect(f.mock.calls[0]![0]).toBe(
      "https://stats.nba.com/stats/playergamelogs?Season=2026-27&SeasonType=Regular+Season&MeasureType=Base&LeagueID=00",
    );
  });

  it("parses rows, keeping numeric columns in stats", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(SAMPLE)));
    expect(await fetchPlayerGameLogs("2026-27", "Base")).toEqual([
      {
        playerId: 7,
        name: "A Player",
        team: "SAS",
        gameId: "0022600001",
        gameDate: "2026-11-04T00:00:00",
        stats: { PLAYER_ID: 7, MIN: 31.5, PTS: 20, USG_PCT: null },
      },
    ]);
  });

  it("retries a 5xx and then succeeds", async () => {
    const f = vi.fn().mockResolvedValueOnce(new Response("", { status: 500 })).mockResolvedValueOnce(json(SAMPLE));
    vi.stubGlobal("fetch", f);
    expect(await fetchPlayerGameLogs("2026-27", "Base", { retryDelayMs: 0 })).toHaveLength(1);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("gives up after repeated 5xx", async () => {
    const f = vi.fn().mockImplementation(async () => new Response("", { status: 500 }));
    vi.stubGlobal("fetch", f);
    await expect(fetchPlayerGameLogs("2026-27", "Base", { retryDelayMs: 0 })).rejects.toBeInstanceOf(UpstreamUnavailableError);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it.each([429, 403])("never retries a %i and reports it as rate limiting", async (status) => {
    const f = vi.fn().mockImplementation(async () => new Response("", { status }));
    vi.stubGlobal("fetch", f);
    await expect(fetchPlayerGameLogs("2026-27", "Base", { retryDelayMs: 0 })).rejects.toBeInstanceOf(RateLimitedError);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("treats a 200 with no resultSets as a failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => json({ resource: "gamelogs" })));
    await expect(fetchPlayerGameLogs("2026-27", "Base", { retryDelayMs: 0 })).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });

  it("returns no rows for a 200 with an empty rowSet", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ resultSets: [{ headers: ["PLAYER_ID"], rowSet: [] }] })));
    expect(await fetchPlayerGameLogs("2026-27", "Base")).toEqual([]);
  });

  it("rejects when the request outlasts the timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) =>
        new Promise((_res, rej) => init.signal!.addEventListener("abort", () => rej(new Error("aborted")))),
      ),
    );
    const p = fetchPlayerGameLogs("2026-27", "Base", { timeoutMs: 60_000 });
    const assertion = expect(p).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
  });
});
