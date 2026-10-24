import { describe, it, expect } from "vitest";
import { buildShadingPayload, sampleInfoFor } from "../../src/background/shadingBaseline.js";
import type { PlayerStatRow } from "../../src/shared/types.js";

function r(id: number, team: string, gp: number, mpg: number, stats: Record<string, number | null>): PlayerStatRow {
  return { nbaId: id, name: `P${id}`, teamAbbr: team, position: null, stats: { ADV_GP: gp, ADV_MIN: mpg, ...stats } };
}

/** n established SAS players (12 GP, 30 MPG) with the given EFG_PCT values. */
function established(values: number[]): PlayerStatRow[] {
  return values.map((v, i) => r(100 + i, "SAS", 12, 30, { EFG_PCT: v }));
}

describe("sampleInfoFor", () => {
  it("reads Advanced MIN as minutes per game, not a season total", () => {
    // Live 2026-27 data: Javonte Green, 2 GP, Advanced MIN 15.5 equals Base
    // PerGame MIN 15.5 and does not change under Per36.
    const green: PlayerStatRow = { nbaId: 9, name: "Green", teamAbbr: "NYK", position: null, stats: { ADV_GP: 2, ADV_MIN: 15.5 } };
    expect(sampleInfoFor(green, 2)).toEqual({ small: false, gp: 2, teamGames: 2, mpg: 15.5 });
  });

  it("flags fewer than 25% of team games as small", () => {
    expect(sampleInfoFor(r(1, "SAS", 2, 30, {}), 12)).toEqual({ small: true, gp: 2, teamGames: 12, mpg: 30 });
  });

  it("flags under 8 MPG as small even with plenty of games", () => {
    expect(sampleInfoFor(r(1, "SAS", 18, 7, {}), 20).small).toBe(true);
  });

  it("does not flag 25% of games at 8 MPG exactly", () => {
    expect(sampleInfoFor(r(1, "SAS", 3, 8, {}), 12).small).toBe(false);
  });

  it("treats missing or zero GP as small without throwing", () => {
    expect(sampleInfoFor(r(1, "SAS", 0, 0, {}), 10)).toEqual({ small: true, gp: 0, teamGames: 10, mpg: 0 });
    const bare: PlayerStatRow = { nbaId: 2, name: "X", teamAbbr: "SAS", position: null, stats: {} };
    expect(sampleInfoFor(bare, 10).small).toBe(true);
  });
});

describe("buildShadingPayload", () => {
  it("uses the team's highest GP as team games", () => {
    const rows = [...established(Array(24).fill(0.5)), r(1, "SAS", 2, 30, { EFG_PCT: 0.5 })];
    const p = buildShadingPayload(rows, { y: rows[24]! });
    expect(p.sampleByYahooId.y).toEqual({ small: true, gp: 2, teamGames: 12, mpg: 30 });
  });

  it("computes mean and population SD over non-small players only", () => {
    const vals = Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 0.5 : 0.6));
    const rows = [...established(vals), r(1, "SAS", 1, 5, { EFG_PCT: 1.0 })];
    const b = buildShadingPayload(rows, {}).baseline.EFG_PCT!;
    expect(b.mean).toBeCloseTo(0.55, 6);
    expect(b.sd).toBeCloseTo(0.05, 6);
  });

  it("returns null baseline for a stat with fewer than 20 baseline players", () => {
    const vals = Array.from({ length: 19 }, (_, i) => (i % 2 === 0 ? 0.5 : 0.6));
    expect(buildShadingPayload(established(vals), {}).baseline.EFG_PCT).toBeNull();
  });

  it("returns null baseline when SD is 0", () => {
    expect(buildShadingPayload(established(Array(20).fill(0.55)), {}).baseline.EFG_PCT).toBeNull();
  });

  it("returns sample info per requested Yahoo id, null for unmapped", () => {
    const rows = established(Array(20).fill(0.5));
    const p = buildShadingPayload(rows, { a: rows[0]!, b: null });
    expect(p.sampleByYahooId.a).toEqual({ small: false, gp: 12, teamGames: 12, mpg: 30 });
    expect(p.sampleByYahooId.b).toBeNull();
  });
});
