# Advanced column shading - design

Date: 2026-10-24
Status: approved 2026-10-24

## Intent

On the Yahoo Players page the user hunts for pickups. HoopRadar's three injected columns (eFG%, TS%, USG%) are plain numbers today, so finding the efficient shooters or the heavily involved bench players means reading every cell. Shading each cell by where the value sits against the league lets the eye find them at a glance.

Two specific things the user wants to spot:

1. **Efficient shooters**: high eFG% and TS%.
2. **Players heavily involved when on the floor**: high USG%, including players who get little playing time. A low-minutes, high-usage player is a possible breakout before the minutes catch up, so these players must be shaded, not hidden.

Because low-minute players are exactly the ones with noisy numbers, small samples are shaded like everyone else but visibly marked.

## Goals

- Background fill on every eFG%, TS% and USG% cell HoopRadar injects, on the Players page and on My Team (Average Stats > current season, which reuses the Players page module).
- eFG% and TS% on a diverging quality scale: red (poor), yellow (league average), green (elite).
- USG% on a single-hue intensity scale: light (low usage) to deeper blue (high usage). Usage is a role, not good or bad, so it must not use red/green.
- Small-sample cells keep their fill and get a corner dot with an explanatory hover.
- The baseline (mean and spread) is computed live from league-wide nba.com data for the selected window.

## Non-goals

- No shading on Yahoo's own stat columns (PTS, REB, FG%, etc.).
- No user settings for colours or thresholds (that belongs to the future Options page).
- No sorting of the injected columns (explicitly skipped by the user; ROADMAP keeps it under "Deferred indefinitely").
- No new nba.com requests. Shading must reuse data the extension already fetches.

## Anti-goals (would count as failure even if it technically works)

- Text becoming hard to read on any fill.
- Shading that makes a small-sample player look as trustworthy as an established one (no marker, or a marker nobody notices).
- Red/green as the only signal: the two ends must also differ in brightness for colourblind users.
- Extra load on stats.nba.com (see the bot-detection notes in `CLAUDE.md`).

## Decided by the user

### Colours ("deeper pastel", chosen from mockups)

Text stays Yahoo's normal dark text on every fill.

eFG% and TS%, by z-score against the baseline, linear interpolation between stops, clamped beyond +/-2:

| z | colour |
|---|---|
| -2 or below | `#ef9a9a` (soft red, lighter than a standard red) |
| -1 | `#f5bf94` |
| 0 (league mean) | `#f9e595` (yellow) |
| +1 | `#b5d9a2` |
| +2 or above | `#7dbb88` (muted green, darker than the red end) |

USG%, same z-score rule:

| z | colour |
|---|---|
| -2 or below | `#eceffa` |
| -1 | `#d6dbf3` |
| 0 | `#bfc8ec` |
| +1 | `#a6b1e3` |
| +2 or above | `#8d9ada` |

Full colour is reached at +/-2 standard deviations (the user agreed to 2 rather than their initial 3, because at 3 almost everything renders the same yellow).

### Small-sample marker

A small dark dot (about 6px, `#333`) in the top-left corner of each of the three cells, colour unchanged. Hovering the cell shows text like: `Small sample: 2 of 12 team games, 6.0 MPG`.

### Small-sample rule

A player is a small sample in the selected window if **either**:

- he appeared in fewer than 25% of his team's games in that window, **or**
- he averages under 8 minutes per game in the games he played.

The user chose OR over AND: a player with 3 games at 28 minutes is just as shaky as one with 18 games at 7 minutes.

### Scope

Players page and My Team (Average Stats > current season). My Team gets it for free because it runs the Players module.

## Decided in conversation, my calls (flag if wrong)

- **Baseline excludes small samples.** Mean and standard deviation for each stat are computed over league rows in the selected window that are not small samples, so garbage-time lines do not drag the yellow midpoint. Every player, including small samples, is then coloured against that baseline.
- **Population standard deviation** over the baseline rows.
- **Baseline per window.** Season, L10 and L5 each get their own baseline, since L5 is far noisier. PerMode does not affect these three stats (see "Ratio stats are scale-invariant across PerMode" in `CLAUDE.md`), so the baseline need not vary by PerMode.
- **Team games** for the 25% rule = the highest GP among that team's players in the same window's league rows. nba.com's player dashboard has no team game count; the max player GP is a close stand-in (someone on every roster has played every game).
- **Too little data, no shading.** If a stat's baseline has fewer than 20 players, or its standard deviation is 0, cells for that stat render unshaded (no fill, no dot). This covers the first days of a season.
- **Missing values** (unmapped player, no nba.com row, or a null stat) keep the existing plain `-` with no fill and no dot.
- **Minutes per game, independent of PerMode.** Under `Per36` / `Per100Possessions`, Base's `MIN` is not real minutes per game. The Advanced response's `MIN` and `GP` stay the same whatever the PerMode, but `mergeBaseAndAdvanced` lets Base overwrite them. So keep Advanced's `GP` and `MIN` under separate keys during the merge (`ADV_GP`, `ADV_MIN`). Correction after live verification (2026-10-24): Advanced `MIN` is already minutes per game (it matched Base PerGame `MIN` for every player checked), not a season total as first assumed, so MPG is `ADV_MIN` itself. The spider tooltip shares that merge, so this must be additive and leave existing keys untouched. Tests use synthetic rows shaped like the two responses; no live nba.com captures, to stay clear of its bot detection. If this assumption turns out wrong in the browser, fall back to deciding small samples from the `PerGame` rows, which are usually already cached.
- **Where it is computed.** In the service worker, inside the existing `getPlayerStats` path: `handleGetPlayerStats` in `src/background/index.ts` already holds the full league rows for the window via `fetchMergedForWindow`. Compute the baseline and the per-player small-sample flags there and return them with the response. The content side only maps z-scores to colours.

## Constraints

- Follow `CLAUDE.md`: TDD for every logic module, strict TypeScript with `noUncheckedIndexedAccess`, `.js` import extensions, small single-purpose files.
- Injected cells are HoopRadar's own `<td data-hoopradar=...>` (see `renderColumns` in `src/content/injectColumns.ts`), so styling them does not touch Yahoo's markup. Style inline or via the cell; no global stylesheet on Yahoo's page.
- Re-rendering must stay idempotent: `clearHoopradarCells` removes the cells, so fills and dots go with them.
- Message contract changes go through `src/shared/messages.ts` with type guards, like the existing requests.

## Left to the builder

- Data shapes for the baseline and flags in `GetPlayerStatsResponse`.
- Module layout (for example a pure `shading.ts` for z-score to colour, a pure baseline/small-sample module in `src/background/`).
- How the dot is drawn (pseudo-element is not possible inline; an absolutely positioned child element or a background gradient are both fine) and the hover mechanism (`title` attribute is acceptable).
- Interpolation colour space (plain RGB is fine).
