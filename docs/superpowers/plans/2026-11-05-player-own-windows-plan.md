# Player-Own Windows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make L5 and L10 each player's own last games everywhere, show a "last played" line on the radar card for old form, and remove Per 100.

**Architecture:** Season stays on `leaguedashplayerstats`. L5/L10 come from a store that downloads league-wide `playergamelogs` (Base and Advanced) at most once per 6 hours of use, calculates rows for every window and Per mode with pure functions, and caches only the calculated rows. `fetchMergedForWindow` in `src/background/index.ts` routes by window, so the table, shading, percentiles and radar card keep reading the same `PlayerStatRow` shape.

**Tech Stack:** TypeScript strict, Vitest + fake-indexeddb, Chrome MV3 service worker.

**Spec:** `docs/superpowers/specs/2026-11-05-player-own-windows-design.md`

## Global Constraints

- Never fall back to `LastNGames` for L5/L10. Never one request per player. Never average per-game percentages.
- Old form: more than 14 days since last game, or 8 or more of his current team's games since then. Line reads like `Last played Oct 12 (3 weeks ago)`.
- Stale status reads like `Couldn't update. Showing data from Nov 3`. No age limit on saved rows.
- Game log calls: 60 s timeout; 5xx retried like the existing client; 403 and 429 never retried and trigger the throttle cooldown.
- Cache keys start `own:` so they never collide with `lps:` entries.
- Yahoo's GP column is not overridden. No table marker for old form.
- No em or en dashes anywhere. Commit as `ccc1236 <145925203+ccc1236@users.noreply.github.com>`. Run `npm run typecheck`, `npm test`, `npm run build` before each commit.

## Review Focus

1. Table and radar card asking at once on a cold page: exactly one download. (Task 5 test.)
2. Download fails with saved rows past 6 hours: saved rows returned with `staleSince`; with none saved: the error propagates. (Task 5 tests.)
3. Season not started, both logs empty: empty rows, no error, and saved rows not overwritten by nothing. (Task 5 test.)
4. A traded player: latest team on the row, team-games-since counted on that team. (Task 4 test.)
5. A saved `Per100Possessions` setting from an older version: falls back to Per Game in both `loadSettings` paths, before any request. (Task 1 tests.)

---

### Task 1: Remove Per 100

**Files:**
- Modify: `src/shared/perModes.ts`, `src/shared/messages.ts:8`, `src/shared/types.ts:2`, `src/shared/settings.ts`, `src/ui/spider-tooltip.ts:201`, `src/shared/columns.ts:73` (comment)
- Modify: `README.md:22,36,91`, `docs/SMOKE.md:190,201`, `CLAUDE.md:7,129`
- Test: `test/unit/settings.test.ts`, `test/unit/nbaClient.test.ts:55`

**Interfaces:**
- Produces: `PerModeKey = "PerGame" | "Per36"`.

- [ ] **Step 1: Failing tests** in `settings.test.ts`, using its existing storage setup: when storage holds `{ window: "Last5", perMode: "Per100Possessions" }`, `loadSettings()` returns `{ window: "Last5", perMode: "PerGame" }`. Same through the `sendMessage` fallback path when `getSettingsResponse.settings.perMode` is `"Per100Possessions"`.
- [ ] **Step 2: Run** `npx vitest run test/unit/settings.test.ts`. Expected: new tests FAIL.
- [ ] **Step 3: Implement.** A local `sanitize(s: FilterSettings)` in `settings.ts` replaces any `perMode` not in `PER_MODE_KEYS` with the default; apply to both return paths. Remove the Per 100 entries and the label branch. Change the `nbaClient.test.ts:55` case to `Per36`. Update the docs lines and the `CLAUDE.md` scope to "two per-modes".
- [ ] **Step 4: Run** `npm run typecheck`, `npm test`, `npm run build`. Expected: all pass, and `grep -rn "Per100\|Per 100" src test/unit README.md docs/SMOKE.md CLAUDE.md` finds only the settings test values.
- [ ] **Step 5: Commit** `feat!: remove the Per 100 mode`.

---

### Task 2: Test the download from the extension (gate, needs the owner)

**Stop here and ask the owner to run this.** It needs their Chrome, and a block on their IP cannot be rolled back. Run at most twice. Nothing else in this plan may start until it passes.

- [ ] **Step 1: Owner runs this** in the HoopRadar service worker console (`chrome://extensions`, **service worker** on the card, after reloading the Task 1 build), and pastes the output:

```js
for (const m of ["Base", "Advanced"]) {
  const t = performance.now();
  const r = await fetch(`https://stats.nba.com/stats/playergamelogs?Season=2025-26&SeasonType=Regular+Season&MeasureType=${m}&LeagueID=00`);
  const text = await r.text();
  console.log(m, r.status, Math.round(performance.now() - t) + " ms", (text.length / 1e6).toFixed(1) + " MB", text.slice(0, 40));
  if (r.status !== 200) break;
  await new Promise((res) => setTimeout(res, 1100));
}
```

- [ ] **Step 2: Judge.** Pass: both 200, JSON bodies, combined time under 30 s, console still alive. Anything else (403, 429, challenge page, worker restart, over 30 s): stop and bring it to the owner. Do not retry.

---

### Task 3: Game log client

**Files:**
- Create: `src/background/nbaGameLogs.ts`
- Test: `test/unit/nbaGameLogs.test.ts`

**Interfaces:**
- Consumes: `RateLimitedError`, `UpstreamUnavailableError` from `src/background/nbaClient.ts`.
- Produces:

```ts
export interface GameLogRow { playerId: number; name: string; team: string; gameId: string; gameDate: string; stats: Record<string, number | null> }
export function fetchPlayerGameLogs(season: string, measure: "Base" | "Advanced", opts?: { retries?: number; retryDelayMs?: number; timeoutMs?: number }): Promise<GameLogRow[]>;
```

- [ ] **Step 1: Failing tests** with a stubbed global `fetch`, following `nbaClient.test.ts`:
  - URL is exactly `https://stats.nba.com/stats/playergamelogs?Season=2026-27&SeasonType=Regular+Season&MeasureType=Base&LeagueID=00`;
  - a `resultSets[0]` of headers and rows parses to `GameLogRow`s, numeric columns only in `stats`;
  - 500 then 200 retries and succeeds; 500 three times throws `UpstreamUnavailableError`;
  - 429 throws `RateLimitedError` after one call; 403 throws `RateLimitedError` after one call;
  - 200 with no `resultSets` throws `UpstreamUnavailableError`, but 200 with an empty `rowSet` returns `[]`;
  - a fetch that never resolves rejects at `timeoutMs` (fake timers, `AbortController`).
- [ ] **Step 2: Run** `npx vitest run test/unit/nbaGameLogs.test.ts`. Expected: FAIL, module missing.
- [ ] **Step 3: Implement.** Default `timeoutMs` 60000, retries 2, delay 800. Treat 403 as `RateLimitedError` so the existing cooldown path applies.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add the playergamelogs client`.

---

### Task 4: Calculate windows and last played (pure)

**Files:**
- Create: `src/background/ownWindows.ts`
- Create: `src/shared/lastPlayed.ts`
- Test: `test/unit/ownWindows.test.ts`, `test/unit/lastPlayed.test.ts`

**Interfaces:**
- Consumes: `GameLogRow` (Task 3), `PlayerStatRow`, `PerModeKey`.
- Produces:

```ts
// src/shared/lastPlayed.ts
export interface LastPlayed { date: string; daysAgo: number; teamGamesSince: number; old: boolean }
export function lastPlayedText(lp: LastPlayed): string;
// src/background/ownWindows.ts
export interface PlayerGame { playerId: number; name: string; team: string; gameId: string; gameDate: string; stats: Record<string, number | null> } // Base + USG_PCT, POSS
export function joinGameLogs(base: GameLogRow[], adv: GameLogRow[]): PlayerGame[];
export function buildOwnWindowRows(games: PlayerGame[], n: number, perMode: PerModeKey): PlayerStatRow[];
export function buildLastPlayed(games: PlayerGame[], now: number): Record<number, LastPlayed>;
```

- [ ] **Step 1: Failing tests** in `ownWindows.test.ts`. Helper `g(playerId, gameId, date, team, stats)`.
  - Own games: a player with games on dates 1,2,3,6,7 and team games on 4,5 gets all five in `n=5`, `GP` and `ADV_GP` 5. A player with 7 games uses the newest 5 only.
  - Fewer than N: 3 games gives `GP` 3.
  - Tie on date sorts by `GAME_ID` descending.
  - Totals not averages: games 1-for-1 and 10-for-20 give `FG_PCT` 11/21; `EFG_PCT` = (FGM + 0.5 x FG3M) / FGA; `TS_PCT` = PTS / (2 x (FGA + 0.44 x FTA)); `FT_PCT` from totals.
  - Per game: `PTS` is total / GP. Per 36: `PTS` is total / total MIN x 36. `MIN` and `ADV_MIN` are total MIN / GP in both modes.
  - `USG_PCT` is sum(value x POSS) / sum(POSS): 0.20 at 100 POSS and 0.30 at 300 POSS gives 0.275.
  - Zero denominators: FGA 0 gives `FG_PCT` null, and no POSS gives `USG_PCT` null.
  - Trade: latest game on a different team sets `teamAbbr` to that team, and earlier-team games still count.
  - `joinGameLogs` adds `USG_PCT` and `POSS` from Advanced by (`playerId`, `gameId`); a Base row with no match keeps nulls.
  - `buildLastPlayed`, `now` = 2026-11-07: last game 14 days ago with 7 team games since has `old: false`; 15 days ago has `old: true`; 3 days ago with 8 of his latest team's games since has `old: true`; 3 days ago with 7 has `old: false`. Team games count distinct `gameId`s for his latest team after his last date.

  In `lastPlayed.test.ts`: `lastPlayedText({ date: "2026-10-12T00:00:00", daysAgo: 21, ... })` is `Last played Oct 12 (3 weeks ago)`; `daysAgo: 7` reads `(1 week ago)`; `daysAgo: 5` reads `(5 days ago)`; `daysAgo: 1` reads `(1 day ago)`. Weeks are `Math.floor(daysAgo / 7)`, used from 7 days up. Parse the date's `YYYY-MM-DD` as a local date so the day never shifts by timezone.
- [ ] **Step 2: Run** `npx vitest run test/unit/ownWindows.test.ts test/unit/lastPlayed.test.ts`. Expected: FAIL, modules missing.
- [ ] **Step 3: Implement** per the spec's table.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: calculate own-game windows and last played`.

---

### Task 5: Own-windows store

**Files:**
- Create: `src/background/ownWindowsStore.ts`
- Test: `test/unit/ownWindowsStore.test.ts`

**Interfaces:**
- Consumes: Tasks 3 and 4; the `get`/`set` shape of `Cache`.
- Produces:

```ts
export interface OwnWindowsResult { rows: PlayerStatRow[]; staleSince: number | null }
export interface OwnWindowsStore {
  getRows(season: string, n: number, perMode: PerModeKey, forceFresh?: boolean): Promise<OwnWindowsResult>;
  getLastPlayed(season: string, nbaId: number): Promise<LastPlayed | null>;
}
export function createOwnWindowsStore(deps: {
  cache: { get<T>(k: string): Promise<T | null>; set<T>(k: string, v: T, ttlMs?: number): Promise<void> };
  fetchLogs: (season: string, measure: "Base" | "Advanced") => Promise<GameLogRow[]>;
  onBlocked: () => void;   // RateLimitedError seen: trigger throttle cooldown
  now?: () => number;
}): OwnWindowsStore;
```

Decision: one cache entry per season, key `own:v1:<season>`, value `{ fetchedAt, rows: { [`${n}:${perMode}`]: PlayerStatRow[] }, lastPlayed }`, built for every n in `WINDOWS` with `lastNGames > 0` and every `PER_MODES` key. Written with a 10-year TTL because the `Cache` deletes on expiry and saved rows have no age limit; freshness is judged by `fetchedAt` against 6 hours in the store.

- [ ] **Step 1: Failing tests**, with an in-memory fake cache and `vi.fn()` `fetchLogs`:
  - cold `getRows` downloads Base and Advanced once and returns rows with `staleSince: null`;
  - a second call within 6 hours makes no download; L5 and L10 in both Per modes all come from that one download;
  - two concurrent `getRows` calls on a cold store share one download (`fetchLogs` called twice in total, not four);
  - `forceFresh` downloads again;
  - older than 6 hours downloads again; if that download rejects, returns saved rows with `staleSince` set to the saved `fetchedAt`;
  - rejection with nothing saved rethrows;
  - `RateLimitedError` calls `onBlocked` once;
  - only one measure type has rows: treated as failure, as above;
  - both empty: returns `{ rows: [], staleSince: null }`, does not overwrite saved rows, and does not throw;
  - `getLastPlayed` returns the saved entry for a known player, `null` for an unknown player or when nothing is saved, and never calls `fetchLogs`.
- [ ] **Step 2: Run** `npx vitest run test/unit/ownWindowsStore.test.ts`. Expected: FAIL, module missing.
- [ ] **Step 3: Implement.** The in-flight download is one shared promise, cleared when settled. `getLastPlayed` reads the saved entry and never triggers a download.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add the own-windows store`.

---

### Task 6: Wire it in and ship the docs

**Files:**
- Modify: `src/background/index.ts`, `src/shared/messages.ts`, `src/shared/spider.ts`, `src/shared/windows.ts` (comment)
- Modify: `src/background/spiderService.ts`, `src/ui/spider-tooltip.ts`, `src/pages/players.ts`
- Create: `src/pages/statusText.ts`
- Modify: `README.md:35,85`, `docs/SMOKE.md`, `CLAUDE.md`, `docs/superpowers/plans/2026-10-31-share-card-plan.md` (note at top)
- Test: `test/unit/statusText.test.ts`, `test/unit/spiderService.test.ts`, `test/unit/spider-tooltip.test.ts`

**Interfaces:**
- Consumes: `OwnWindowsStore`, `LastPlayed`, `lastPlayedText`.
- Produces: `GetPlayerStatsResponse.staleSince: number | null`; `SpiderData.lastPlayed?: LastPlayed`; `BuildSpiderDataArgs.getLastPlayed?: (nbaId: number) => Promise<LastPlayed | null>`; `updatedText(resp: { staleSince: number | null }, now: Date): string` and `loadingText(window: WindowKey): string` in `src/pages/statusText.ts`.

- [ ] **Step 1: Failing tests.**
  - `statusText.test.ts`: `updatedText({ staleSince: null }, d)` is `Updated <time>`; with `staleSince` of Nov 3 it is `Couldn't update. Showing data from Nov 3`. `loadingText("Season")` is `Loading...`; `loadingText("Last5")` is `Loading game logs...`.
  - `spiderService.test.ts`: `getLastPlayed` resolving an entry puts it on `data.lastPlayed`; absent or null leaves it undefined.
  - `spider-tooltip.test.ts`: `lastPlayed` with `old: true` renders `[data-role="last-played"]` with the `lastPlayedText` under the name; `old: false` or absent renders none.
- [ ] **Step 2: Run** those three files. Expected: new tests FAIL.
- [ ] **Step 3: Implement.** In `index.ts`, create the store with `fetchLogs` wrapped in `throttle.run(...)` and `onBlocked: () => throttle.triggerCooldown()`. Replace `fetchMergedForWindow` with one that returns `{ rows, staleSince }`: Season as today (`staleSince: null`), others from `store.getRows(season, windowByKey(window).lastNGames, perMode, forceFresh)`. `handleGetPlayerStats` passes `staleSince` through; `buildSpiderData` gets a rows-only adapter plus `getLastPlayed`. In `players.ts`, use `updatedText` at both "Updated" sites (lines 238, 315) and `loadingText(settings.window)` at line 210; a stale status uses state `"error"`. Update the `windows.ts` comment: `lastNGames` is the own-game count; 0 means Season.
- [ ] **Step 4: Run** `npm run typecheck`, `npm test`, `npm run build`. Expected: all pass.
- [ ] **Step 5: Docs.** `README.md` lines 35 and 85 say own last games. `docs/SMOKE.md` adds a section: own-window numbers match a player's game log, the last-played line, the stale status. `CLAUDE.md` adds a gotcha: `LastNGames` is team-scoped, L5/L10 come from `playergamelogs` through `ownWindowsStore`. Share card plan gets a top note: the small-sample chip now only fires for players with fewer total games, the Per mode chip has two values, and a last-played chip is needed; update before building.
- [ ] **Step 6: Manual check in Chrome** (owner, load `dist/`): walk the new SMOKE section on Players and My Team, in L5, L10 and both Per modes. Note cold-load time.
- [ ] **Step 7: Commit** `feat: use each player's own games for L5 and L10`.
