import { describe, expect, it } from "vitest";
import { buildLastPlayed, buildOwnWindowRows, joinGameLogs, type PlayerGame } from "../../src/background/ownWindows.js";
import type { GameLogRow } from "../../src/background/nbaGameLogs.js";

const LINE = { MIN: 30, FGM: 5, FGA: 10, FG3M: 1, FTM: 2, FTA: 2, REB: 4, AST: 3, TOV: 1, STL: 1, BLK: 0, PTS: 13, USG_PCT: 0.2, POSS: 60 };

function g(playerId: number, gameId: string, day: string, team: string, stats: Partial<typeof LINE> = {}): PlayerGame {
  return { playerId, name: `P${playerId}`, team, gameId, gameDate: `${day}T00:00:00`, stats: { ...LINE, ...stats } };
}

const only = (games: PlayerGame[], n = 5, perMode: "PerGame" | "Per36" = "PerGame") => buildOwnWindowRows(games, n, perMode)[0]!;

describe("buildOwnWindowRows", () => {
  it("uses his own games even when he missed team games in between", () => {
    const games = ["01", "02", "03", "06", "07"].map((d, i) => g(1, `g${i}`, `2026-11-${d}`, "HOU"));
    const r = only(games);
    expect(r.stats.GP).toBe(5);
    expect(r.stats.ADV_GP).toBe(5);
  });

  it("takes only the newest N games", () => {
    const games = [1, 2, 3, 4, 5, 6, 7].map((d) => g(1, `g${d}`, `2026-11-0${d}`, "HOU", { PTS: d }));
    const r = only(games);
    expect(r.stats.GP).toBe(5);
    expect(r.stats.PTS).toBeCloseTo((3 + 4 + 5 + 6 + 7) / 5, 6);
  });

  it("includes a player with fewer than N games, showing the true count", () => {
    expect(only([g(1, "a", "2026-11-01", "HOU"), g(1, "b", "2026-11-02", "HOU"), g(1, "c", "2026-11-03", "HOU")]).stats.GP).toBe(3);
  });

  it("breaks a same-date tie by game id, newest first", () => {
    const r = only([g(1, "0001", "2026-11-01", "HOU", { PTS: 10 }), g(1, "0002", "2026-11-01", "HOU", { PTS: 20 })], 1);
    expect(r.stats.PTS).toBe(20);
  });

  it("calculates percentages from totals, not by averaging games", () => {
    const r = only([
      g(1, "a", "2026-11-01", "HOU", { FGM: 1, FGA: 1, FG3M: 0, FTM: 0, FTA: 0, PTS: 2 }),
      g(1, "b", "2026-11-02", "HOU", { FGM: 10, FGA: 20, FG3M: 2, FTM: 3, FTA: 4, PTS: 25 }),
    ]);
    expect(r.stats.FG_PCT).toBeCloseTo(11 / 21, 6);
    expect(r.stats.FT_PCT).toBeCloseTo(3 / 4, 6);
    expect(r.stats.EFG_PCT).toBeCloseTo((11 + 0.5 * 2) / 21, 6);
    expect(r.stats.TS_PCT).toBeCloseTo(27 / (2 * (21 + 0.44 * 4)), 6);
  });

  it("averages counting stats per game in Per Game", () => {
    const r = only([g(1, "a", "2026-11-01", "HOU", { PTS: 10, MIN: 20 }), g(1, "b", "2026-11-02", "HOU", { PTS: 20, MIN: 40 })]);
    expect(r.stats.PTS).toBe(15);
    expect(r.stats.MIN).toBe(30);
    expect(r.stats.ADV_MIN).toBe(30);
  });

  it("scales counting stats by minutes in Per 36, leaving minutes per game alone", () => {
    const r = only([g(1, "a", "2026-11-01", "HOU", { PTS: 10, MIN: 20 }), g(1, "b", "2026-11-02", "HOU", { PTS: 20, MIN: 40 })], 5, "Per36");
    expect(r.stats.PTS).toBeCloseTo((30 / 60) * 36, 6);
    expect(r.stats.MIN).toBe(30);
    expect(r.stats.ADV_MIN).toBe(30);
  });

  it("weights USG% by possessions", () => {
    const r = only([g(1, "a", "2026-11-01", "HOU", { USG_PCT: 0.2, POSS: 100 }), g(1, "b", "2026-11-02", "HOU", { USG_PCT: 0.3, POSS: 300 })]);
    expect(r.stats.USG_PCT).toBeCloseTo(0.275, 6);
  });

  it("gives null for zero denominators", () => {
    const r = only([g(1, "a", "2026-11-01", "HOU", { FGA: 0, FGM: 0, FG3M: 0, FTA: 0, FTM: 0, PTS: 0, POSS: 0 })]);
    expect(r.stats.FG_PCT).toBeNull();
    expect(r.stats.FT_PCT).toBeNull();
    expect(r.stats.EFG_PCT).toBeNull();
    expect(r.stats.TS_PCT).toBeNull();
    expect(r.stats.USG_PCT).toBeNull();
  });

  it("shows a traded player's latest team and still counts his earlier games", () => {
    const r = only([g(1, "a", "2026-11-01", "HOU"), g(1, "b", "2026-11-02", "LAL")]);
    expect(r.teamAbbr).toBe("LAL");
    expect(r.stats.GP).toBe(2);
  });

  it("returns one row per player", () => {
    const rows = buildOwnWindowRows([g(1, "a", "2026-11-01", "HOU"), g(2, "a", "2026-11-01", "HOU")], 5, "PerGame");
    expect(rows.map((r) => r.nbaId).sort()).toEqual([1, 2]);
  });
});

describe("joinGameLogs", () => {
  const row = (playerId: number, gameId: string, stats: Record<string, number | null>): GameLogRow => ({
    playerId, name: "P", team: "HOU", gameId, gameDate: "2026-11-01T00:00:00", stats,
  });

  it("adds USG_PCT and POSS from Advanced by player and game", () => {
    const [j] = joinGameLogs([row(1, "a", { PTS: 10 })], [row(1, "a", { USG_PCT: 0.25, POSS: 70 }), row(1, "b", { USG_PCT: 0.9, POSS: 1 })]);
    expect(j!.stats).toMatchObject({ PTS: 10, USG_PCT: 0.25, POSS: 70 });
  });

  it("keeps a Base row with no Advanced match, with nulls", () => {
    const [j] = joinGameLogs([row(1, "a", { PTS: 10 })], []);
    expect(j!.stats).toMatchObject({ PTS: 10, USG_PCT: null, POSS: null });
  });
});

describe("buildLastPlayed", () => {
  const NOW = new Date("2026-11-07T12:00:00").getTime();
  /** Player 1's last game on `lastDay`, then `since` games by his team without him. */
  function scene(lastDay: string, since: number): PlayerGame[] {
    const out = [g(1, "mine", lastDay, "HOU")];
    for (let i = 0; i < since; i++) out.push(g(2, `t${i}`, "2026-11-06", "HOU"));
    return out;
  }

  it("is not old at exactly 14 days with 7 team games since", () => {
    expect(buildLastPlayed(scene("2026-10-24", 7), NOW)[1]).toMatchObject({ daysAgo: 14, teamGamesSince: 7, old: false });
  });

  it("is old at 15 days", () => {
    expect(buildLastPlayed(scene("2026-10-23", 7), NOW)[1]).toMatchObject({ daysAgo: 15, old: true });
  });

  it("is old at 8 team games since, however recent", () => {
    expect(buildLastPlayed(scene("2026-11-04", 8), NOW)[1]).toMatchObject({ daysAgo: 3, teamGamesSince: 8, old: true });
  });

  it("is not old at 7 team games since", () => {
    expect(buildLastPlayed(scene("2026-11-04", 7), NOW)[1]!.old).toBe(false);
  });

  it("counts only his latest team's games since, for a traded player", () => {
    const games = [g(1, "x", "2026-11-01", "HOU"), g(1, "mine", "2026-11-04", "LAL")];
    for (let i = 0; i < 9; i++) games.push(g(2, `hou${i}`, "2026-11-05", "HOU"));
    for (let i = 0; i < 2; i++) games.push(g(3, `lal${i}`, "2026-11-05", "LAL"));
    expect(buildLastPlayed(games, NOW)[1]).toMatchObject({ teamGamesSince: 2, old: false });
  });

  it("counts a team game once however many players were in it", () => {
    const games = [g(1, "mine", "2026-11-04", "HOU"), g(2, "t", "2026-11-05", "HOU"), g(3, "t", "2026-11-05", "HOU")];
    expect(buildLastPlayed(games, NOW)[1]!.teamGamesSince).toBe(1);
  });
});
