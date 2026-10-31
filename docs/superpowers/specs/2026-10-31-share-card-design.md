# Share card - design

Date: 2026-10-31
Status: approved 2026-10-31

## Intent

GMs argue about players: pick him up, drop him, he's heating up, he's cooling off. The argument is almost always **recent form against the whole season**. HoopRadar's pinned spider card already shows exactly that comparison (Season, L10, L5 overlaid), but only inside the user's own browser.

The share card turns a pinned spider card into a polished image a GM can paste into X, Discord or a league chat to make the case. It makes **one headline point**, with the radar and a numbers table as backup so a sceptical reader can check the claim rather than trust a picture.

Every shared card also carries `hoopradar.app`, so sharing doubles as word of mouth.

## Goals

- From a **pinned** spider card, two actions: **Copy image** (primary, for pasting straight into X or a chat) and **Download PNG**.
- A 1200x675 image (X's uncropped in-feed 16:9), rendered at 2x for sharpness, matching the approved mockup (v4, below).
- One headline that names the player's most relevant recent change.
- Honest context on the image: season, the actual Per mode of the data, the as-of date, and a small-sample warning when it applies.

## Non-goals

- Two-player comparison card (likely the next feature; out of scope here).
- A direct "post to X" button (X intents cannot carry an image; it would only open an empty post).
- Other image sizes (square, story).
- Share actions on the hover preview (pinned card only).
- Sharing from the stats table or anywhere else on the page.

## Anti-goals (failure even if it technically works)

- Any Yahoo league data on the image: league name, team names, manager names. Cards are posted publicly.
- NBA headshots, team logos, Yahoo or NBA branding, or anything implying affiliation.
- A chip that misstates the data (for example "Per Game" on Per 36 numbers, or a stale date).
- A headline that hides a small sample: a 2-game hot streak presented as a trend with no warning.
- New nba.com requests or new runtime dependencies.

## The image (decided with the user, via mockups)

Reference: mockup v4, approved 2026-10-31. Layout, 1200x675:

- **Left:** the spider radar, larger than the tooltip's, Season (grey), Last 10 (teal `#0ABAB5`), Last 5 (amber `#F59E0B`) overlaid, axis labels, a faint 50th-percentile ring, legend "Season / Last 10 / Last 5" below.
- **Right, top to bottom:**
  - Position and team abbreviation (for example `PG,SG · SAS`). Position is the player's eligibility as shown on the Yahoo page (user decision; nba.com data we fetch has no position, `position` is always null). It is player info, not league info. `src/content/yahoo.ts` already parses the `"SAS - PG,SG"` text. Team as the NBA abbreviation only, no full name, no logo. *(my call)*
  - The player's name, large and bold.
  - Subtitle exactly: `League percentile across nine stats` (the user rejected "fantasy categories" because TS% and USG% are not Yahoo categories).
  - Context chips: season (`2026-27`), Per mode (`Per Game` / `Per 36` / `Per 100`), `as of <Mon D>`, and the headline chip (accent-coloured). A small-sample chip when it applies.
  - A 9-row table: Stat | Season | Last 10 | Last 5, each cell showing the value plus a percentile badge. Badge colours follow the pastel scale used for the column shading. Rows in the spider axis order: 3PM, PTS, REB, AST, STL, BLK, TO (inverted, labelled `TO↓`), TS%, USG%.
  - Footer: the HoopRadar logo (from `site/favicon.svg`, with a faint outline so it shows on the dark background) followed by `hoopradar.app` in the site's orange (`#ff8a3d`); no separate "HoopRadar" wordmark (user decision). Right-aligned, two lines: `Data: nba.com` / `Not affiliated with Yahoo or the NBA`.
- **Look:** dark slate gradient background with an orange left edge, matching the landing site's palette; tabular (fixed-width) numerals; one bundled open-licence font so every image renders identically. Font: Inter (SIL OFL), subset to Latin, smallest footprint that covers regular, semibold and heavy weights plus tabular numerals. It will look slightly different from the system-font mockup; that is accepted. *(my call)*

## Behaviour

### Headline (user decision)

1. If the user has clicked an axis on the pinned card (the existing axis popout), that axis is the headline.
2. Otherwise, the axis with the **largest absolute percentile change between Season and L5**, up or down.

Wording: `<STAT> up: L5 <pct>th (season <pct>th)` or `<STAT> down: ...`, using ordinal suffixes. TO uses its inverted percentile so "up" always means better. This replaces the mockup's shorter "L5 trending up: USG% 94th", because the season number is what a sceptical reader checks. *(my call)* An "up" headline uses the orange accent chip; a "down" headline uses a soft red tint. *(my call)*

If L5 is missing, compare Season with L10 instead; if neither recent window exists, omit the headline chip.

### Context chips must be truthful

- Per mode chip reflects the Per mode of the data actually drawn.
- `as of` is the date the underlying data was fetched, not the date of sharing. *(my call: if fetch time is not available to the content side, add it to the spider data rather than using "today")*
- Season string is the current season.

### Small samples

The card uses its own, stricter rule (user decision): the recent window used by the headline is a small sample if the player's games in it are fewer than the window size (fewer than 5 in L5, fewer than 10 in L10), **or** he averages under 8 minutes per game in it. Then show a chip such as `L5: 3 of 5 games` (or `L5: 6.0 MPG` when only the minutes test fires) next to the headline.

The column shading's rule (under 25% of team games) is deliberately looser; in L5 it only fires at 1 game. The card can therefore flag a player the table does not dot. That is accepted: the card makes a public claim about a short stretch, so it must warn on any incomplete one.

### Missing data

- A window with no data shows `-` in its table column and its shape is left off the radar (as the tooltip already does).
- Unmapped players have no pinned card data, so no share actions.

### Output

- **Copy image:** writes the PNG to the clipboard; brief confirmation on the card ("Copied"). If the clipboard write fails, say so and leave Download available.
- **Download PNG:** filename `hoopradar-<player-slug>-<yyyy-mm-dd>.png`, for example `hoopradar-jaylen-marlow-2026-10-31.png`. *(my call)*

## Constraints

- Follow `CLAUDE.md`: TDD for every logic module (headline selection, chip text, filename, small-sample decision), strict TypeScript, `.js` imports, small single-purpose files.
- No new runtime dependencies. Draw the image locally (the radar is already SVG; render onto a canvas).
- No new nba.com requests: everything comes from the data the pinned card already holds, extended where needed.
- UI stays plain DOM plus shadow DOM, no custom elements (see `CLAUDE.md`).
- Any change to the spider data shape (`SpiderData` / `WindowSlice` in `src/shared/spider.ts`) must be additive; the tooltip keeps working unchanged.
- No em or en dashes in files, commits or docs. Commit as `ccc1236 <145925203+ccc1236@users.noreply.github.com>`.

## Known data gaps the builder must fill

- `WindowSlice` has no games-played count or team-games count, which the small-sample chip needs. Add them additively in the spider service, which already holds each window's league rows (Advanced `GP`/`MIN` are available as `ADV_GP` / `ADV_MIN` after the merge; Advanced `MIN` is minutes per game).
- `SpiderData` has no fetch timestamp for the `as of` chip.

## Left to the builder

- Module layout and data shapes for the additions above.
- How the image is drawn (Canvas 2D directly, or SVG rendered to canvas) as long as the output matches the mockup and text uses the bundled font.
- How the font is bundled and loaded (for example `web_accessible_resources` plus `FontFace`, or inlined), choosing the option with the smallest footprint; note any manifest change in the plan.
- Whether clipboard writing needs a manifest permission; verify in Chrome and note it.
- Exact spacing, sizes and badge thresholds, matching the mockup.
- How the Yahoo position reaches the card (for example passed from the page row that was hovered, or included in the existing scrape and mapping data).
