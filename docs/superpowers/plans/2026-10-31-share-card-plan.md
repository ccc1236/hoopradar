# Share Card Implementation Plan

> **Update before building (2026-11-07):** L5 and L10 became each player's own last games, and Per 100 was removed. So the small-sample chip now only fires for players with fewer total games, the Per mode chip has two values, `SpiderData` now carries `lastPlayed`, and a last-played chip is needed. Revise Task 2 accordingly.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Copy image and Download PNG actions to the pinned spider card, producing a 1200x675 (2x) share image that makes one headline point about a player's recent form.

**Architecture:** The service worker adds games played, minutes per game and an as-of timestamp to the existing spider data. A pure content-side module turns `SpiderData` plus page context into a `ShareCardModel` (headline, chips, table rows, filename). A Canvas 2D renderer draws the model to a PNG using a bundled Inter font. The pinned tooltip gets two buttons that call injected copy/download actions.

**Tech Stack:** TypeScript strict, Vitest + jsdom, Vite/crxjs, Canvas 2D, `FontFace`, `navigator.clipboard`.

**Spec:** `docs/superpowers/specs/2026-10-31-share-card-design.md` (approved mockup: v4, layout described in the spec)

## Global Constraints

- Image 1200x675 logical, drawn at 2x (2400x1350 canvas).
- Subtitle exactly `League percentile across nine stats`.
- Footer: HoopRadar logo (from `site/favicon.svg`, faint outline) then `hoopradar.app` in `#ff8a3d`; right-aligned `Data: nba.com` / `Not affiliated with Yahoo or the NBA`. No separate wordmark.
- Series colours: Season `#9CA3AF`, Last 10 `#0ABAB5`, Last 5 `#F59E0B`. Up headline chip orange accent; down headline chip soft red tint.
- Headline: clicked axis, else largest absolute Season vs L5 percentile change; wording `<LABEL> up: L5 <ord> (season <ord>)` / `<LABEL> down: ...`; L10 replaces L5 when L5 is missing; no headline when neither exists.
- Small sample (card rule): headline window games < window size (5 or 10) OR MPG < 8; chip `L5: 3 of 5 games`, or `L5: 6.0 MPG` when only minutes fire.
- Position from the Yahoo row (`"SAS - PG,SG"` gives `PG,SG`); team as NBA abbreviation only.
- Filename `hoopradar-<player-slug>-<yyyy-mm-dd>.png`.
- No Yahoo league data, headshots, logos; no new nba.com requests; no new runtime code dependencies; spider data changes additive only.
- Font: Inter (SIL OFL), Latin subset, inlined into the content bundle.
- No em or en dashes anywhere. Commit as `ccc1236 <145925203+ccc1236@users.noreply.github.com>`. Run `npm run typecheck`, `npm test`, `npm run build` before each commit.

**Plan decision (deviation from the spec's wording, low cost):** the `as of` date is the time `buildSpiderData` assembled the data, not the nba.com fetch time. The stat cache does not expose fetch time and its TTL is 6 hours, so the dates differ only for data fetched before midnight and shared after it. Exposing cache timestamps would touch the shared cache for little gain.

## Review Focus

1. A player with no L5 and no L10 data: no headline chip, no small-sample chip, table shows `-`, nothing throws. (Task 2 test.)
2. All percentile changes zero, or the clicked axis lacks a percentile in one window: falls back cleanly (no "up: L5 undefinedth"). (Task 2 tests.)
3. Names with accents or punctuation (`Nikola Jokić`, `D'Angelo Russell`, `Jaren Jackson Jr.`) give a clean filename slug. (Task 2 test.)
4. Clipboard write rejected (permission or focus): the card says so and Download still works. (Task 4 test.)
5. Share buttons on a hover preview or on a "no mapping" card: absent. (Task 4 test.)

---

### Task 1: Games played, MPG and as-of in spider data

**Files:**
- Modify: `src/shared/spider.ts` (`WindowSlice`, `SpiderData`)
- Modify: `src/background/spiderService.ts` (`sliceFor`, data assembly)
- Test: `test/unit/spiderService.test.ts`

**Interfaces:**
- Produces: `WindowSlice.gp?: number` (from `stats.ADV_GP`), `WindowSlice.mpg?: number` (from `stats.ADV_MIN`, already minutes per game); `SpiderData.asOf: number` (epoch ms, `Date.now()` when assembled).

- [ ] **Step 1: Failing test** in `spiderService.test.ts`, reusing its `row()` helper with `ADV_GP: 4, ADV_MIN: 27.5` added to the player's stats: `expect(out.data.windows.season!.gp).toBe(4)`, `expect(out.data.windows.season!.mpg).toBe(27.5)`, and `asOf` equals a faked `Date.now()` (`vi.setSystemTime(new Date("2026-10-31T10:00:00"))`). A second case: a row without `ADV_GP` gives `gp` undefined.
- [ ] **Step 2: Run** `npx vitest run test/unit/spiderService.test.ts`. Expected: new tests FAIL.
- [ ] **Step 3: Implement** the additive fields; only set `gp`/`mpg` when the stat is a finite number.
- [ ] **Step 4: Run** the same command, then `npm test`. Expected: all PASS (tooltip tests unaffected).
- [ ] **Step 5: Commit** `feat: add games played, MPG and as-of to spider data`.

---

### Task 2: Share card model (pure)

**Files:**
- Create: `src/content/shareCardModel.ts`
- Modify: `src/content/shading.ts` (export the stop tables and a `badgeColor` helper)
- Test: `test/unit/shareCardModel.test.ts`, `test/unit/shading.test.ts`

**Interfaces:**
- Consumes: `SpiderData`, `SpiderStatKey` (`src/shared/spider.ts`), `SPIDER_AXES`, `formatAxisValue` (`src/shared/spiderAxes.ts`), Task 1 fields.
- Produces:

```ts
export interface ShareCell { value: string; pct: number | null; badge: string | null }
export interface ShareRow { key: SpiderStatKey; label: string; season: ShareCell; l10: ShareCell; l5: ShareCell }
export interface ShareHeadline { text: string; direction: "up" | "down" }
export interface ShareCardModel {
  name: string; subline: string;            // subline e.g. "PG,SG · SAS"
  chips: string[];                          // season, per mode, "as of Oct 31"
  headline: ShareHeadline | null;
  sampleChip: string | null;
  rows: ShareRow[];                          // SPIDER_AXES order
  radar: { key: SpiderStatKey; label: string; season: number | null; l10: number | null; l5: number | null }[];
  filename: string;
}
export function buildShareCardModel(data: SpiderData, ctx: { activeAxis: SpiderStatKey | null; position: string | null; season: string }): ShareCardModel;
```
- In `src/content/shading.ts`: `badgeColor(key: string, pct: number): string` maps percentile 0..100 linearly onto the existing five stops (0, 25, 50, 75, 100 → stop 0..4), USG_PCT on the blue stops, every other key on the quality stops.

- [ ] **Step 1: Failing tests** (`shareCardModel.test.ts`). Build a `SpiderData` fixture: name `Jaylen Marlow`, team `SAS`, perMode `Per36`, asOf `2026-10-31T10:00`, season/L10/L5 slices with percentiles for all nine keys (USG season 82, L5 94; PTS season 84, L5 93; BLK season 47, L5 55; others small changes), L5 `gp: 5, mpg: 30`.

```ts
it("headlines the clicked axis", () => {
  expect(m({ activeAxis: "PTS" }).headline).toEqual({ text: "PTS up: L5 93rd (season 84th)", direction: "up" });
});
it("otherwise headlines the largest Season vs L5 change", () => {
  expect(m({}).headline?.text).toBe("USG% up: L5 94th (season 82nd)");
});
it("says down for a drop", () => { /* season 80, L5 60 on REB, the largest change */ /* "REB down: L5 60th (season 80th)", direction "down" */ });
it("falls back to L10 when L5 is missing, and to no headline when both are", () => { /* text starts "USG% up: L10" ; then null */ });
it("skips a clicked axis lacking a percentile and uses the largest change", () => {});
it("gives no headline when every change is zero", () => {});
it("flags a short recent window", () => { /* L5 gp 3 → sampleChip "L5: 3 of 5 games" */ });
it("flags low minutes", () => { /* L5 gp 5, mpg 6 → "L5: 6.0 MPG" */ });
it("no sample chip for a full window at 8+ MPG, or without gp", () => {});
it("builds chips from the data", () => { expect(m({}).chips).toEqual(["2026-27", "Per 36", "as of Oct 31"]); });
it("builds the subline from position and team", () => { expect(m({ position: "PG,SG" }).subline).toBe("PG,SG · SAS"); expect(m({ position: null }).subline).toBe("SAS"); });
it("slugs the filename", () => {
  // Jaylen Marlow → "hoopradar-jaylen-marlow-2026-10-31.png"
  // "Nikola Jokić" → "hoopradar-nikola-jokic-2026-10-31.png"; "D'Angelo Russell" → "hoopradar-dangelo-russell-..."; "Jaren Jackson Jr." → "hoopradar-jaren-jackson-jr-..."
});
it("shows - and no badge for a missing window", () => { /* l5 null → rows[0].l5 { value: "-", pct: null, badge: null } */ });
```
In `shading.test.ts`: `badgeColor("PTS", 50)` is `#f9e595`, `badgeColor("PTS", 100)` is `#7dbb88`, `badgeColor("USG_PCT", 0)` is `#eceffa`.

Write the commented cases as real fixtures and assertions with the values shown. Helper `m(ctx)` merges `{ activeAxis: null, position: "SF", season: "2026-27" }` with overrides.

- [ ] **Step 2: Run** `npx vitest run test/unit/shareCardModel.test.ts test/unit/shading.test.ts`. Expected: FAIL (module missing, `badgeColor` missing).
- [ ] **Step 3: Implement.** Percentiles are rounded with `Math.round` before comparing and printing; ordinals via a local helper (`1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 22nd...`). Ties for largest change go to the earlier axis in `SPIDER_AXES`. Per mode labels: `PerGame` → `Per Game`, `Per36` → `Per 36`, `Per100Possessions` → `Per 100`. Date chip uses `toLocaleDateString("en-US", { month: "short", day: "numeric" })`. Slug: NFD-normalise, strip diacritics, lower-case, drop apostrophes, replace other non `[a-z0-9]` runs with `-`, trim `-`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: build the share card model`.

---

### Task 3: Render the card to PNG

**Files:**
- Create: `src/ui/share-card-render.ts`
- Create: `src/ui/assets/inter-latin.woff2` (Inter variable, Latin subset)
- Create: `src/ui/assets/logo.svg` (copy of `site/favicon.svg`)
- Modify: `package.json` only if a devDependency is used to source the font (see Step 1)

**Interfaces:**
- Consumes: `ShareCardModel` (Task 2), `badgeColor` (Task 2).
- Produces: `renderShareCardPng(model: ShareCardModel): Promise<Blob>` (PNG, 2400x1350).

- [ ] **Step 1: Source the font.** Ask the user before downloading. Preferred: `npm i -D @fontsource-variable/inter` and copy its Latin `wght` woff2 into `src/ui/assets/inter-latin.woff2`, keeping the OFL licence text alongside as `src/ui/assets/inter-OFL.txt`. Import it with Vite's `?inline` so it ships as a data URL inside the content bundle (no `web_accessible_resources`, no manifest change).
- [ ] **Step 2: Implement** `renderShareCardPng`: load the font once via `new FontFace("HRInter", url)` + `document.fonts.add`, create an offscreen canvas 2400x1350, `ctx.scale(2, 2)`, draw per the spec's layout (radar on the left from `model.radar`, 4 rings, 50th label, three series polygons with the Global Constraints colours, L5 points; right column subline, name, subtitle, chips, headline chip coloured by direction, sample chip, 9-row table with `badgeColor` badges, footer with the logo drawn from the SVG via an `Image` and `hoopradar.app`), then `canvas.toBlob("image/png")`. Use `font-variant-numeric`-equivalent by drawing numbers with Inter's tabular figures (`ctx.fontVariantNumeric` is not supported; set the `tnum` feature via `FontFace` `featureSettings: '"tnum"'`).
- [ ] **Step 3: Verify manually.** jsdom has no canvas, so this module has no unit test (same policy as the entry points). Render it once from a scratch page (or verify after Task 4 from a pinned card) and compare against the v4 mockup: layout, colours, font, nothing clipped at 1200x675.
- [ ] **Step 4: Run** `npm run typecheck`, `npm test`, `npm run build`. Expected: pass; note the content bundle size increase in the commit message.
- [ ] **Step 5: Commit** `feat: render share cards to PNG with bundled Inter`.

---

### Task 4: Copy and Download on the pinned card

**Files:**
- Modify: `src/ui/spider-tooltip.ts` (buttons, handlers, status text, new deps)
- Modify: `src/content/yahoo.ts` (export `positionFromRow`)
- Modify: `src/pages/players.ts` (pass share deps)
- Modify: `docs/SMOKE.md`, `README.md` (one feature line)
- Test: `test/unit/spider-tooltip.test.ts`, `test/unit/yahooScrape.test.ts`

**Interfaces:**
- Consumes: `buildShareCardModel` (Task 2), `renderShareCardPng` (Task 3).
- Produces:
  - `positionFromRow(row: Element): string | null` in `src/content/yahoo.ts`, using the existing `TEAM_POS_RE` span parse (`"SAS - PG,SG"` → `"PG,SG"`).
  - `SpiderTooltipDeps.share?: { copy(model: ShareCardModel): Promise<void>; download(model: ShareCardModel): void }` and `SpiderTooltipDeps.season?: () => string`.

- [ ] **Step 1: Failing tests.**
  - `yahooScrape.test.ts`: `positionFromRow` returns `"PG,SG"` for a row whose span reads `SAS - PG,SG`, and `null` when no such span exists.
  - `spider-tooltip.test.ts`, with a fake `share` dep (`copy: vi.fn().mockResolvedValue(undefined)`, `download: vi.fn()`):
    - a pinned card with data shows buttons `[data-role="share-copy"]` and `[data-role="share-download"]`;
    - a hover preview shows neither; a "no mapping" card shows neither;
    - clicking copy calls `share.copy` once with a model whose `name` is the player's and whose `headline` reflects a clicked axis when one is active; the card then shows `Copied`;
    - when `share.copy` rejects, the card shows `Copy failed, use Download` and the download button still works;
    - clicking download calls `share.download` once.
- [ ] **Step 2: Run** `npx vitest run test/unit/spider-tooltip.test.ts test/unit/yahooScrape.test.ts`. Expected: new tests FAIL.
- [ ] **Step 3: Implement.** Buttons render only when `pinned` and data has loaded. The model is built from `currentData`, `activeAxisKey`, `positionFromRow(anchor.closest("tr"))` captured at mount, and `deps.season?.() ?? ""`. Default `share` in `src/pages/players.ts`: `copy` renders via `renderShareCardPng` and calls `navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])`; `download` renders and clicks a temporary `<a download=model.filename>` with an object URL, revoked afterwards. Pass `season: currentSeasonString`.
- [ ] **Step 4: Run** the same command, then `npm run typecheck`, `npm test`, `npm run build`. Expected: all pass.
- [ ] **Step 5: Docs.** `docs/SMOKE.md` new section "13. Share card": pin a card, Copy, paste into a chat (image appears, 1200x675, correct Per mode chip and date); click an axis then Copy (headline is that axis); Download (filename pattern); switch Per mode and share again (chip and numbers change); a player with a short L5 shows the sample chip. `README.md` "What it does": one bullet for the share card.
- [ ] **Step 6: Manual check in Chrome** (load `dist/`): walk SMOKE section 13 and confirm whether clipboard writing works without a manifest permission. If it does not, add `clipboardWrite` to `permissions` and note it in the commit.
- [ ] **Step 7: Commit** `feat: copy or download a share card from the pinned spider card`.
