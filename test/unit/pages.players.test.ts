import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { run } from "../../src/pages/players.js";
import "../../src/ui/filter-bar.js";
import type { GetPlayerStatsResponse } from "../../src/shared/messages.js";

const FIXTURE = readFileSync(resolve(__dirname, "../fixtures/yahoo/players.html"), "utf8");

function mockSendMessage(playerCount: number): void {
  const sendMessage = vi.fn(async (msg: { type: string; yahooIds?: string[] }) => {
    if (msg.type === "getPlayerStats") {
      const ids = msg.yahooIds ?? [];
      const byYahooId: Record<string, unknown> = {};
      for (const id of ids) {
        byYahooId[id] = {
          nbaId: Number(id), name: `Player ${id}`, teamAbbr: "DEN", position: null,
          stats: { PTS: 25.5, REB: 8.0, EFG_PCT: 0.55, TS_PCT: 0.6, USG_PCT: 28.0 },
        };
      }
      const r: GetPlayerStatsResponse = {
        type: "getPlayerStatsResponse",
        byYahooId: byYahooId as GetPlayerStatsResponse["byYahooId"],
        fetchedAt: Date.now(),
        staleSince: null,
        shading: { baseline: {}, sampleByYahooId: {} },
      };
      return r;
    }
    if (msg.type === "bootstrapPlayers") {
      return { type: "bootstrapPlayersResponse", added: playerCount, unmapped: [] };
    }
    return { type: "error", code: "BAD_REQUEST", message: "" };
  });
  (chrome as unknown as { runtime: { sendMessage: typeof sendMessage } }).runtime = {
    sendMessage,
  };
}

describe("players page module", () => {
  beforeEach(() => {
    document.documentElement.innerHTML = FIXTURE;
    mockSendMessage(50);
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("mounts a filter bar above the stats table", async () => {
    await run({ kind: "players", leagueId: "123456" });
    expect(document.querySelector(".hoopradar-bar-host")).not.toBeNull();
  });

  it("injects three new column headers (eFG%, TS%, USG%)", async () => {
    await run({ kind: "players", leagueId: "123456" });
    const headers = Array.from(
      document.querySelectorAll('th[data-hoopradar]:not([data-hoopradar="group"])'),
    ).map((h) => h.textContent);
    expect(headers).toEqual(["eFG%", "TS%", "USG%"]);
  });

  it("adds an Advanced colspan group header to the real Yahoo fixture", async () => {
    await run({ kind: "players", leagueId: "123456" });
    const group = document.querySelector('th[data-hoopradar="group"]') as HTMLTableCellElement | null;
    expect(group).not.toBeNull();
    expect(group!.textContent).toBe("Advanced");
    expect(group!.colSpan).toBe(3);
  });

  it("ignores a slow response after the user has moved to another window", async () => {
    let releaseL5: (v: unknown) => void = () => {};
    const stats = (id: string, efg: number) => ({ nbaId: Number(id), name: "P", teamAbbr: "DEN", position: null, stats: { EFG_PCT: efg } });
    const respond = (ids: string[], efg: number) => ({
      type: "getPlayerStatsResponse",
      byYahooId: Object.fromEntries(ids.map((id) => [id, stats(id, efg)])),
      fetchedAt: 0,
      staleSince: null,
      shading: { baseline: {}, sampleByYahooId: {} },
    });
    const sendMessage = vi.fn(async (msg: { type: string; window?: string; yahooIds?: string[] }) => {
      if (msg.type === "getPlayerStats") {
        const ids = msg.yahooIds ?? [];
        if (msg.window === "Last5") {
          await new Promise((res) => (releaseL5 = res));
          return respond(ids, 0.111);
        }
        return respond(ids, 0.555);
      }
      return { type: "bootstrapPlayersResponse", added: 0, unmapped: [] };
    });
    (chrome as unknown as { runtime: { sendMessage: unknown } }).runtime = { sendMessage };

    await run({ kind: "players", leagueId: "123456" });
    const bar = document.querySelector(".hoopradar-bar-host")!;
    const change = (window: string) =>
      bar.dispatchEvent(new CustomEvent("hoopradar-filter-change", { detail: { window, perMode: "PerGame" } }));
    const flush = () => new Promise((res) => setTimeout(res, 0));
    const cell = () => document.querySelector('td[data-hoopradar="EFG_PCT"]')!.textContent;

    change("Last5");
    await flush();
    change("Season");
    await flush();
    expect(cell()).toBe(".555");
    releaseL5(null);
    await flush();
    expect(cell()).toBe(".555");
  });

  it("populates adv cells in player rows", async () => {
    await run({ kind: "players", leagueId: "123456" });
    const advCells = document.querySelectorAll("td[data-hoopradar]");
    expect(advCells.length).toBeGreaterThan(0);
  });
});
