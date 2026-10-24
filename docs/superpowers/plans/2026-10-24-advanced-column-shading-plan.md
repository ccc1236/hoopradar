# Advanced Column Shading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shade HoopRadar's injected eFG%, TS% and USG% cells by z-score against a live league baseline, and mark small-sample players with a corner dot.

**Architecture:** The service worker already holds every league row for the selected window inside `handleGetPlayerStats`. A pure background module turns those rows into a per-stat baseline (mean, SD) and per-player sample info, returned alongside the existing `byYahooId`. A pure content module maps (value, baseline) to a colour; `renderColumns` applies fill, dot and hover to its own cells.

**Tech Stack:** TypeScript strict + `noUncheckedIndexedAccess`, Vitest + jsdom, Vite/crxjs. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-24-advanced-column-shading-design.md`

## Global Constraints

- No new nba.com requests; reuse rows `fetchMergedForWindow` already returns.
- Colours, eFG% and TS% (z, linear RGB interpolation, clamped beyond +/-2): -2 `#ef9a9a`, -1 `#f5bf94`, 0 `#f9e595`, +1 `#b5d9a2`, +2 `#7dbb88`.
- Colours, USG%: -2 `#eceffa`, -1 `#d6dbf3`, 0 `#bfc8ec`, +1 `#a6b1e3`, +2 `#8d9ada`.
- Small sample: GP < 25% of team games in the window OR MPG < 8 (MPG = Advanced total MIN / Advanced GP).
- Team games = highest Advanced GP among that team's rows in the window.
- Baseline excludes small samples; population SD; null (no shading for that stat) when fewer than 20 baseline players or SD is 0.
- Dot: about 6px, `#333`, top-left corner. Hover text exactly `Small sample: {gp} of {teamGames} team games, {mpg.toFixed(1)} MPG`.
- Text colour is never changed. Missing values keep plain `-`, no fill, no dot.
- Local imports use `.js`; type-only imports use `import type`; no types named `Request`/`Response`.
- No em or en dashes in any file, commit message or doc. Commit as `ccc1236 <145925203+ccc1236@users.noreply.github.com>`.
- Before every commit: `npm run typecheck`, `npm test`, `npm run build` all pass.

## Review Focus

1. A player whose Advanced GP is 0 or missing must count as a small sample, not divide by zero or throw. (Task 2 test.)
2. Values beyond +/-2 SD (a 2-for-2 rookie at 1.000 eFG%) clamp to the end colour rather than extrapolating to invalid RGB. (Task 3 test.)
3. First days of the season: fewer than 20 baseline players leaves those cells unshaded and dot-free, not coloured against a meaningless mean. (Task 2 and Task 4 tests.)
4. Switching window or PerMode re-renders: fills and dots must not stack or linger from the previous render. (Task 4 test.)
5. Unmapped or stat-less players keep a plain `-` with no fill and no dot, even when the rest of the table is shaded. (Task 4 test.)

---

### Task 1: Preserve Advanced GP and MIN through the merge

**Files:**
- Modify: `src/background/mergeStats.ts`
- Test: `test/unit/mergeStats.test.ts`

**Interfaces:**
- Produces: merged rows carry `stats.ADV_GP` and `stats.ADV_MIN` (copies of the Advanced response's `GP` and `MIN`, PerMode-independent totals per `CLAUDE.md`). All existing keys unchanged.

- [ ] **Step 1: Write the failing test** in `test/unit/mergeStats.test.ts`, using the file's existing `row()` helper:

```ts
it("keeps Advanced GP and MIN under ADV_ keys even though Base overwrites GP and MIN", () => {
  const base = [row(1, "P", { GP: 10, MIN: 3.0, PTS: 4 })];
  const adv = [row(1, "P", { GP: 10, MIN: 30, USG_PCT: 0.3 })];
  const m = mergeBaseAndAdvanced(base, adv).get(1)!;
  expect(m.stats.MIN).toBe(3.0);
  expect(m.stats.GP).toBe(10);
  expect(m.stats.ADV_MIN).toBe(30);
  expect(m.stats.ADV_GP).toBe(10);
});

it("does not invent ADV_ keys for a Base-only row", () => {
  const m = mergeBaseAndAdvanced([row(2, "B", { GP: 3, MIN: 5 })], []).get(2)!;
  expect(m.stats.ADV_MIN).toBeUndefined();
  expect(m.stats.ADV_GP).toBeUndefined();
});
```

- [ ] **Step 2: Run** `npx vitest run test/unit/mergeStats.test.ts`. Expected: the first new test FAILS (`ADV_MIN` undefined).
- [ ] **Step 3: Implement.** When seeding from an Advanced row, also set `ADV_GP` and `ADV_MIN` from that row's `GP` and `MIN` (only when present). Extend the doc comment with one line explaining why.
- [ ] **Step 4: Run** the same command. Expected: all PASS. Then `npm test`: all PASS (spider tests unaffected).
- [ ] **Step 5: Commit** `feat: keep Advanced GP and MIN through the stats merge`.

---

### Task 2: Shading baseline and small-sample info (background, pure)

**Files:**
- Create: `src/shared/shading.ts` (types only)
- Create: `src/background/shadingBaseline.ts`
- Test: `test/unit/shadingBaseline.test.ts`

**Interfaces:**
- Consumes: `stats.ADV_GP`, `stats.ADV_MIN` from Task 1; `PlayerStatRow`, `YahooPlayerId` from `src/shared/types.ts`.
- Produces, in `src/shared/shading.ts`:

```ts
export interface StatBaseline { mean: number; sd: number }
export type ShadingBaseline = Partial<Record<string, StatBaseline | null>>;
export interface SampleInfo { small: boolean; gp: number; teamGames: number; mpg: number }
export interface ShadingPayload {
  baseline: ShadingBaseline;
  sampleByYahooId: Record<YahooPlayerId, SampleInfo | null>;
}
export const SHADED_KEYS = ["EFG_PCT", "TS_PCT", "USG_PCT"] as const;
```

- Produces, in `src/background/shadingBaseline.ts`:
  - `sampleInfoFor(row: PlayerStatRow, teamGames: number): SampleInfo`
  - `buildShadingPayload(leagueRows: readonly PlayerStatRow[], byYahooId: Record<YahooPlayerId, PlayerStatRow | null>): ShadingPayload`
  - Constants `SMALL_GP_SHARE = 0.25`, `SMALL_MPG = 8`, `MIN_BASELINE_PLAYERS = 20`.

- [ ] **Step 1: Write the failing tests** in `test/unit/shadingBaseline.test.ts`. Helper `r(id, team, gp, minTotal, stats)` builds a `PlayerStatRow` with `stats: { ADV_GP: gp, ADV_MIN: minTotal, ...stats }`.

```ts
it("flags fewer than 25% of team games as small", () => {
  expect(sampleInfoFor(r(1, "SAS", 2, 60, {}), 12)).toEqual({ small: true, gp: 2, teamGames: 12, mpg: 30 });
});
it("flags under 8 MPG as small even with plenty of games", () => {
  expect(sampleInfoFor(r(1, "SAS", 18, 126, {}), 20).small).toBe(true); // 7.0 MPG
});
it("does not flag 25% of games at 8 MPG exactly", () => {
  expect(sampleInfoFor(r(1, "SAS", 3, 24, {}), 12).small).toBe(false);
});
it("treats missing or zero GP as small without throwing", () => {
  expect(sampleInfoFor(r(1, "SAS", 0, 0, {}), 10)).toEqual({ small: true, gp: 0, teamGames: 10, mpg: 0 });
});
it("uses the team's highest GP as team games", () => {
  // 24 established SAS players at 12 GP, one at 2 GP: the 2-GP player gets teamGames 12.
});
it("computes mean and population SD over non-small players only", () => {
  // 20 established players with EFG_PCT alternating .50/.60 plus one small player at 1.000:
  // baseline.EFG_PCT is { mean: 0.55, sd: 0.05 } (toBeCloseTo, 6).
});
it("returns null baseline for a stat with fewer than 20 baseline players", () => {
  // 19 established players: baseline.EFG_PCT === null.
});
it("returns null baseline when SD is 0", () => {
  // 20 established players all at .55: baseline.EFG_PCT === null.
});
it("returns sample info per requested Yahoo id, null for unmapped", () => {
  // byYahooId { "a": <row>, "b": null } => sampleByYahooId.a is a SampleInfo, .b is null.
});
```

Write the commented cases out as real fixtures and assertions; the comments give the exact inputs and expected values.

- [ ] **Step 2: Run** `npx vitest run test/unit/shadingBaseline.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** both functions. Small if `gp < SMALL_GP_SHARE * teamGames || mpg < SMALL_MPG`; `mpg = gp > 0 ? minTotal / gp : 0`; missing `ADV_GP`/`ADV_MIN` read as 0. Team games come from a single pass over `leagueRows` taking the max `ADV_GP` per `teamAbbr`. Baseline loops `SHADED_KEYS` over non-small rows with a finite value.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: compute shading baseline and small-sample info`.

---

### Task 3: Colour mapping (content, pure)

**Files:**
- Create: `src/content/shading.ts`
- Test: `test/unit/shading.test.ts`

**Interfaces:**
- Consumes: `StatBaseline`, `SampleInfo` from `src/shared/shading.ts`.
- Produces:
  - `colorFor(key: string, value: number | null | undefined, baseline: StatBaseline | null | undefined): string | null` returns `#rrggbb`, or null when value or baseline is missing or `key` is not shaded.
  - `sampleTitle(info: SampleInfo): string`.

- [ ] **Step 1: Write the failing tests:**

```ts
const b = { mean: 0.55, sd: 0.05 };
it("is yellow at the mean", () => expect(colorFor("EFG_PCT", 0.55, b)).toBe("#f9e595"));
it("hits the stops at +/-1 and +/-2", () => {
  expect(colorFor("TS_PCT", 0.60, b)).toBe("#b5d9a2");
  expect(colorFor("TS_PCT", 0.65, b)).toBe("#7dbb88");
  expect(colorFor("EFG_PCT", 0.50, b)).toBe("#f5bf94");
  expect(colorFor("EFG_PCT", 0.45, b)).toBe("#ef9a9a");
});
it("clamps beyond +/-2", () => {
  expect(colorFor("EFG_PCT", 1.0, b)).toBe("#7dbb88");
  expect(colorFor("EFG_PCT", 0.0, b)).toBe("#ef9a9a");
});
it("interpolates halfway between stops", () => {
  expect(colorFor("EFG_PCT", 0.575, b)).toBe("#d7df9c"); // midpoint of #f9e595 and #b5d9a2, rounded
});
it("uses the blue scale for USG_PCT", () => {
  const u = { mean: 0.2, sd: 0.05 };
  expect(colorFor("USG_PCT", 0.2, u)).toBe("#bfc8ec");
  expect(colorFor("USG_PCT", 0.25, u)).toBe("#a6b1e3");
  expect(colorFor("USG_PCT", 0.1, u)).toBe("#eceffa");
});
it("returns null without a value, a baseline, or for an unshaded key", () => {
  expect(colorFor("EFG_PCT", null, b)).toBeNull();
  expect(colorFor("EFG_PCT", 0.5, null)).toBeNull();
  expect(colorFor("PTS", 20, b)).toBeNull();
});
it("formats the hover text", () => {
  expect(sampleTitle({ small: true, gp: 2, teamGames: 12, mpg: 6 })).toBe("Small sample: 2 of 12 team games, 6.0 MPG");
});
```

- [ ] **Step 2: Run** `npx vitest run test/unit/shading.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement.** Stop tables from Global Constraints keyed by z in [-2, -1, 0, 1, 2]; `z = (value - mean) / sd` clamped to [-2, 2]; per-channel linear interpolation, `Math.round`, lower-case hex.
- [ ] **Step 4: Run** the same command. Expected: PASS. (If the halfway expectation is off by one on a channel from rounding, fix the expected hex to the correctly rounded midpoint, not the algorithm.)
- [ ] **Step 5: Commit** `feat: map advanced stat z-scores to shading colours`.

---

### Task 4: Wire it through the message and render the cells

**Files:**
- Modify: `src/shared/messages.ts` (`GetPlayerStatsResponse`)
- Modify: `src/background/index.ts` (`handleGetPlayerStats`)
- Modify: `src/content/injectColumns.ts` (`renderColumns`)
- Modify: `src/pages/players.ts` (both `renderColumns` call sites, `paint` and the refresh handler)
- Modify: `docs/SMOKE.md`
- Test: `test/unit/injectColumns.test.ts`

**Interfaces:**
- Consumes: `ShadingPayload` (Task 2), `buildShadingPayload` (Task 2), `colorFor`, `sampleTitle` (Task 3).
- Produces: `GetPlayerStatsResponse` gains `shading: ShadingPayload`. `renderColumns(table, data, shading?: ShadingPayload): void`; omitting `shading` renders exactly as today.

- [ ] **Step 1: Write the failing tests** in `test/unit/injectColumns.test.ts`, reusing `mkTable()` and `SAMPLE` (Luka `6014`: EFG .563, TS .617, USG .368; `404` unmapped):

```ts
const SHADING: ShadingPayload = {
  baseline: { EFG_PCT: { mean: 0.563, sd: 0.05 }, TS_PCT: { mean: 0.517, sd: 0.05 }, USG_PCT: null },
  sampleByYahooId: { "6014": { small: true, gp: 2, teamGames: 12, mpg: 6 }, "404": null },
};
it("fills advanced cells from the baseline", () => {
  // Luka's EFG cell style.backgroundColor === "rgb(249, 229, 149)" (#f9e595, z=0)
  // Luka's TS cell === "rgb(125, 187, 136)" (#7dbb88, z=+2)
  // Luka's USG cell has no background (baseline null)
});
it("marks small samples with a dot and hover text on shaded cells", () => {
  // EFG and TS cells each contain one [data-hoopradar-dot] element and title "Small sample: 2 of 12 team games, 6.0 MPG"
  // USG cell (unshaded) has no dot
});
it("leaves unmapped players unshaded and dot-free", () => {
  // row 404: all three cells "-", no background, no dot, no title
});
it("does not stack dots or keep fills across re-renders", () => {
  // renderColumns(t, SAMPLE, SHADING) twice, then renderColumns(t, SAMPLE): no dots, no backgrounds
});
it("renders as before when no shading is passed", () => {
  // renderColumns(t, SAMPLE): advanced cells have no background and no dot
});
```

Write the commented cases as real assertions with the values shown.

- [ ] **Step 2: Run** `npx vitest run test/unit/injectColumns.test.ts`. Expected: new tests FAIL.
- [ ] **Step 3: Implement in `renderColumns`.** For each advanced cell, `colorFor(col.key, stats?.[col.key], shading?.baseline[col.key])`. When non-null: set `td.style.backgroundColor`. If the player's sample info is small, also set `td.style.position = "relative"`, append a `<span data-hoopradar-dot>` (absolute, `top: 4px; left: 4px`, 6px circle, background `#333`, `pointer-events: none`) and set `td.title = sampleTitle(info)`. Unshaded cells get no dot even for small samples. The dot lives inside HoopRadar's own `td`, so `clearHoopradarCells` already removes it.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Wire the producer and consumer.** Add `shading: ShadingPayload` to `GetPlayerStatsResponse`; in `handleGetPlayerStats` set `shading: buildShadingPayload(rows, byYahooId)`; pass `resp.shading` / `r.shading` as the third argument at both `renderColumns` call sites in `src/pages/players.ts`.
- [ ] **Step 6: Verify.** `npm run typecheck`, `npm test`, `npm run build`. Expected: all pass.
- [ ] **Step 7: Add a smoke section to `docs/SMOKE.md`:** on Players and on My Team (Average Stats > current season), eFG%/TS% cells show red to yellow to green fills and USG% light to deeper blue; a low-minutes player shows corner dots with the hover text; switching Season/L10/L5 recolours; switching Per Game/Per 36/Per 100 keeps the same colours and the same dots; unmapped players show plain `-`.
- [ ] **Step 8: Manual check in Chrome** (load `dist/`, reload extension), walk the new SMOKE section. If the dots look wrong under Per 36 or Per 100 (for example every player flagged), the `ADV_MIN` totals assumption from Task 1 is wrong: stop and report, the spec's fallback is to judge small samples from the `PerGame` rows.
- [ ] **Step 9: Commit** `feat: shade eFG%, TS% and USG% cells and mark small samples`.
