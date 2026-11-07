# L5 and L10 as each player's own last games - design

Date: 2026-11-05
Status: approved 2026-11-07

## Intent

HoopRadar's L5 and L10 exist to show a player's recent form for pickup and drop decisions. Today they send nba.com's `LastNGames` setting, which means the **team's** last N games: a player who sat out 2 of Houston's last 5 gets an "L5" made of 3 games.

The owner wants L5 and L10 to be **the player's own last 5 and 10 games, however long ago those were**. A player out for three weeks should show how he was performing in his last games before the injury, not a thin sample or an empty row.

## Evidence

From the divac session, stats.nba.com, season 2026-27, 2026-11-05. HoopRadar sends the same setting (`src/background/nbaClient.ts:69`) and nothing post-processes the result.

- Of 324 players with 5+ season games, 91 show fewer than 5 games with `LastNGames=5`.
- Alperen Sengun: `LastNGames=5` is 3 GP, 19.7 PTS, exactly his games inside Houston's last 5. His own last 5 average 21.0 PTS.
- Jaylen Brown: 4 GP, 22.8 PTS, against 21.4 PTS for his own last 5.

## Goals

- L5 and L10 use each player's own most recent games everywhere they appear: table overrides, advanced columns, shading, radar card, percentiles.
- The radar card makes old form visible with a "last played" line.
- Per 100 is removed from the whole extension (owner decision: it means little in fantasy and the owner has not used it).

## Non-goals

- No change to the Season window; it stays on `leaguedashplayerstats`.
- No marker in the table for old form (owner decision).
- No settings for the thresholds, and no new windows.

## Anti-goals (failure even if the numbers look right)

- One nba.com request per player.
- Silently using team-window numbers when the new download fails. A window is the player's own games or the last good data, never a mix of the two meanings.
- Averaging per-game percentages (a 1-for-1 night must not count the same as 10-for-20).

## Decided by the owner

- L5/L10 are the player's own last games, regardless of how long ago.
- **"Last played" line on the radar card:** under the player's name, shown only when the player's last game is old, worded like `Last played Oct 12 (3 weeks ago)`. Old means **more than 14 days since his last game, or his team has played 8 or more games since then**. Same line in every window and Per mode. The table stays clean.
- The share card gets the same note as a chip when that feature is built.
- Per 100 is dropped, as the first step of this project.

## My calls (flag if wrong)

- **"Missed 8+" means games in a row since his last appearance**, counted as distinct `GAME_ID`s for his current team dated after his last game. A player who missed 8 earlier but played last night gets no line.
- **Old-form players stay in the L5/L10 percentile and shading baselines.** They are not excluded by a recency rule. HoopRadar ranks every player returned, so no season-based qualification is added.
- **The small-sample rule is unchanged.** Team games in a window still come from the highest `ADV_GP` on the team, which is now effectively the window size, and the under-8-MPG test still applies. The window rows supply `ADV_GP` and `ADV_MIN` so this keeps working.
- **Team on a window row** is the team in the player's most recent game; a window can span two teams.

## Data source

nba.com `playergamelogs` (plural), league-wide, one call each:

```
GET https://stats.nba.com/stats/playergamelogs?Season=<season>&SeasonType=Regular+Season&MeasureType=Base&LeagueID=00
GET https://stats.nba.com/stats/playergamelogs?Season=<season>&SeasonType=Regular+Season&MeasureType=Advanced&LeagueID=00
```

Each row is one player in one game. Relied on: `PLAYER_ID`, `PLAYER_NAME`, `TEAM_ABBREVIATION`, `GAME_ID`, `GAME_DATE`, `MIN`, `FGM`, `FGA`, `FG3M`, `FG3A`, `FTM`, `FTA`, `REB`, `AST`, `TOV`, `STL`, `BLK`, `PTS` (Base); `USG_PCT`, `POSS` (Advanced). Join on (`PLAYER_ID`, `GAME_ID`).

Measured by divac from a server, not from an extension: full 2025-26 season 26,651 rows per call, Base about 10.2 MB and Advanced about 13.2 MB uncompressed, 6 s and 10 s cold. 2026-27 on Nov 5: 2,729 rows, about 2 s per call. `GAME_DATE` looks like `2026-11-04T00:00:00`, `MIN` is decimal, every Base row had an Advanced match, and no row had zero minutes. divac saw no 403 or 429 at low volume, but a Python client timed out with the same headers, so behaviour varies by client.

Our header rule (`rules/nba-headers.json`, `||stats.nba.com/`) already covers this path.

## First step: prove it from the extension

Dropping Per 100 comes first and stands on its own: it stays dropped whatever this test finds. *(my call)*

Then, before building the rest, run a real cold download of both calls from inside the extension's service worker, with `Season=2025-26` as the worst case. Record status, time, size, and whether the worker survives. If nba.com blocks it, the worker dies, or the two calls together take more than 30 seconds on the owner's connection *(my call; Chrome may also end a worker whose fetch response takes about that long, so check this)*, stop and bring it back to the owner. Do not keep building on an assumption, and do not quietly stay on team-window numbers. While a game log download runs, the filter bar says so instead of the plain "Loading...". *(my call)*

Safeguards for this test, because a block on the owner's IP cannot be rolled back *(my call)*: run it by hand, at most twice, before anything automatic can repeat it, and stop at once on any 403, 429 or challenge page rather than retrying. In the shipped code, a 403 or 429 on a game log call is never retried, and it triggers the existing throttle cooldown.

## How a window is calculated

For each player, sort his games newest first by `GAME_DATE`, then `GAME_ID`, and take up to N (5 or 10).

| Stat | Per Game | Per 36 |
|---|---|---|
| `GP`, `ADV_GP` | games taken | same |
| `MIN`, `ADV_MIN` | total minutes / GP | same (minutes per game, never scaled) |
| `PTS`, `REB`, `AST`, `STL`, `BLK`, `FG3M`, `TOV`, `FGM`, `FGA`, `FTM`, `FTA` | total / GP | total / total minutes x 36 |
| `FG_PCT`, `FT_PCT` | from totals | same |
| `TS_PCT` | PTS / (2 x (FGA + 0.44 x FTA)) from totals | same |
| `EFG_PCT` | (FGM + 0.5 x FG3M) / FGA from totals | same |
| `USG_PCT` | possession-weighted mean: sum(value x POSS) / sum(POSS) | same |

- A zero denominator gives `null`, which already renders as a dash.
- A player with fewer than N games is included with the games he has, and the row's `GP` holds the true count. Yahoo's own GP column is not overridden and keeps showing season GP (owner decision); the window's count stays in the data and appears in the small-sample hover when that applies.
- Window rows carry only these fields; nothing in HoopRadar reads other columns on them.

Accuracy, tested by divac applying this method to full 2026-27 seasons to date (about 7 games each, 218 players) against nba.com's Season figures: TS% median error 0.0003, worst 0.0005; USG% median 0.0006, worst 0.0031. Pin a small fixture of this check in tests rather than calling nba.com.

## Requests and caching

- HoopRadar has no background schedule. It fetches only when a Players or My Team page loads or refreshes, a filter changes, or a radar card opens. So the game logs download at most once per 6 hours **while the extension is in use**.
- Window requests drop from up to 8 (L5 and L10 x 2 Per modes x Base and Advanced) to 2, though each is much larger. Season requests are unchanged.
- Cache **calculated window rows**, not raw downloads, in the existing IndexedDB stat cache with the existing 6-hour lifetime. Use cache keys distinct from today's `LastNGames` entries, so a rollback to an older version refetches rather than showing own-game numbers under team-window logic. *(my call)* Refresh forces a new download, as today.
- Concurrent callers must share one in-flight download. The radar card asks for all three windows and the table asks for one, so a cold page must not trigger the download twice.
- Downloads go through the existing throttle, and retry 5xx like `fetchLeagueDashPlayerStats`. Add an explicit 60 s timeout on these two calls.

## Failure behaviour

- A 200 with no `resultSets`, or only one measure type having rows, is a failure.
- Both measure types empty means the season has not started: no rows, not an error.
- On failure, keep the last good window rows if any exist, even past their lifetime, with no age limit (owner decision), and say so on the filter bar instead of "Updated <time>", for example `Couldn't update. Showing data from Nov 3`. If no rows exist, surface the existing error status. Never fall back to `LastNGames`.

## Dropping Per 100

Remove it from `src/shared/perModes.ts`, `PER_MODE_KEYS` in `src/shared/messages.ts`, `PerModeKey` in `src/shared/types.ts`, and the radar card's label in `src/ui/spider-tooltip.ts`; update tests. A user with `Per100Possessions` saved in `chrome.storage.sync` must fall back to Per Game rather than break (`loadSettings` currently merges saved values unchecked). Pin that with a test. The `getPlayerStats` and `getSpiderData` request guards will reject the old value, so the settings fallback must happen before any request.

## Docs to update when this ships

- `README.md`: the Per 100 mentions, line 35 ("games the player actually played"), and the FAQ's L5/L10 answer, which become true.
- `docs/SMOKE.md`: Per 100 steps removed; add own-window and last-played checks.
- `CLAUDE.md`: "three per-modes" and the Per 100 mentions; add a gotcha that `LastNGames` is team-scoped and that L5/L10 come from `playergamelogs`.
- `docs/superpowers/plans/2026-10-31-share-card-plan.md` and its design: the small-sample chip now only fires for players with fewer total games, Per mode chip has two values, and a last-played chip is added. Revisit before building the share card.
- `src/shared/columns.ts` comment mentioning Per-100.

## Verification

- Unit tests with fixtures: own-games selection when a player missed team games, fewer than N games, sort order, totals-based percentages, Per 36 scaling, possession weighting, zero denominators, a trade (latest team), last-played thresholds at exactly 14 and 15 days and at 7 and 8 team games, malformed responses, and failure keeping last good rows.
- In Chrome: for a player who has missed team games, the L5 stats match his own last 5 games from his game log, and the service worker console shows `GP` 5 on his row (where he has 5+ games). A failed download shows the "Couldn't update" status with saved numbers. A long-absent player shows the last-played line and keeps numbers. Shading and radar still work in L5 and L10.

## Left to the builder

- Module layout and data shapes, including how `lastPlayed` reaches the radar card (additive to `SpiderData`).
- How `fetchMergedForWindow` routes Season versus L5/L10, and whether game log fetching shares a helper with the existing client.
- Relative-time wording details beyond the example (days, weeks).
