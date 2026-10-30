# HoopRadar Landing Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Revised 2026-10-30 for the single-screen splash (replaces the multi-section plan of 2026-10-24).

**Goal:** A single-screen splash page in `site/` (leather bars, whiteboard, animated logo, one "Download on GitHub" button with the latest version from GitHub), plus README additions carrying the features, screenshots, install notes and FAQ the page no longer has.

**Architecture:** `site/index.html` with inline SVG (animated logo, whiteboard play) and a small inline script for the version line; `site/styles.css`; `site/leather.svg` as a repeating background. The version-line logic is a pure function in `site/version.js` (ES module, imported by the page and by the test). A Vitest guard test parses the page with `jsdom`. The preview PNG is rendered once from SVG with `sharp` by `scripts/render-og.mjs`.

**Tech Stack:** HTML, CSS, SVG, a few lines of browser JS; Vitest + jsdom; sharp (all existing dev dependencies).

**Spec:** `docs/superpowers/specs/2026-10-24-landing-site-design.md`

## Global Constraints

- Site files live in `site/`. Also allowed: `test/unit/site.test.ts`, `scripts/render-og.mjs`, `docs/images/*`, `README.md`. Nothing under `src/` or `public/`; `vite.config.ts`, `manifest.json`, `package.json` unchanged.
- No em dash (U+2014) or en dash (U+2013) in any created or edited file or commit message.
- The only network request the page makes: `fetch("https://api.github.com/repos/ccc1236/hoopradar/releases/latest")`. No other external scripts, stylesheets, fonts, images or `url()`. System font stack.
- Releases URL, exactly: `https://github.com/ccc1236/hoopradar/releases`. Site address: `https://hoopradar.pages.dev`.
- Copy, exactly: kicker "Your league sees points."; headline "You see who's under the radar." with "under the radar" in a `<span>` coloured `#ff8a3d`; line "A free Chrome extension that puts eFG%, TS%, USG% and Last 5 / Last 10 form on your Yahoo Fantasy Basketball pages."; button label "Download on GitHub"; version line "Latest: v0.2.5, released 24 Oct 2026" format; footer "Not affiliated with Yahoo or the NBA."
- Colours: ink `#22313d`, accent `#ff8a3d`, board `#f4f2ec`, logo gradient `#4A6E84 -> #2D4A5B -> #1F3645`, sketch ink `#2D4A5B`, X's `#e0552b`, seam `#1b1310`, footer text `#fff3e6`.
- No Yahoo, NBA, team or ball-maker logos; no real names; no divac mark; nothing about why it is not on the Chrome Web Store beyond "Not on the Chrome Web Store yet".
- No horizontal scroll at 360px; 16px gutters; `prefers-reduced-motion: reduce` shows final frames.
- Commits as `ccc1236 <145925203+ccc1236@users.noreply.github.com>`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Before each commit: `npm run typecheck`, `npm test`, `npm run build` pass.

## Review Focus

1. GitHub API down, rate limited (403), or no releases (404): the button must still show and work, with the version line hidden. Pinned by `formatLatest` tests in Task 1 (null on bad input) and the browser check in Task 3.
2. Short laptop screens (1366x650) and phones (360x640): content must not be cut off or overlap the sketch unreadably; if it does not fit, the page scrolls vertically rather than clipping. Checked in Task 3 Step 3.
3. Reduced motion: logo, sketch and text visible immediately, not stuck at opacity 0. Guard test asserts the media rule (Task 1); visual check in Task 3.
4. Link preview: absolute `og:image` on the agreed host, and the file exists at 1200x630. Tests in Task 1 and Task 3.
5. Logo final frame matches the shipped logo (path `d`, circle and line attributes). Test in Task 1.

---

### Task 1: The splash page

**Files:**
- Create: `site/index.html`, `site/styles.css`, `site/version.js`, `site/leather.svg`, `site/favicon.svg`, `site/README.md`
- Test: `test/unit/site.test.ts`

**Interfaces:**
- Produces: `export function formatLatest(release: unknown): string | null` in `site/version.js`. Returns `"Latest: <tag_name>, released <D Mon YYYY>"` (day without leading zero, English short month, UTC date of `published_at`) when `release` is an object with string `tag_name` and a parseable `published_at`; otherwise `null`.
- Produces: in the test file, `loadDoc(): Document` and `siteFiles(): string[]` helpers, reused by Task 3.
- Produces: `.cta small[data-latest]`, the element the script fills (hidden attribute until filled).

- [ ] **Step 1: Write the failing test** `test/unit/site.test.ts` (node environment, `import { JSDOM } from "jsdom"`, `node:fs`; import `formatLatest` from `../../site/version.js` and add a sibling `site/version.d.ts` declaring it so `npm run typecheck` passes). Tests:
  - `formatLatest formats a release`: `formatLatest({ tag_name: "v0.2.5", published_at: "2026-10-24T09:00:00Z" })` equals `"Latest: v0.2.5, released 24 Oct 2026"`.
  - `formatLatest rejects bad input`: returns `null` for `null`, `{}`, `{ message: "Not Found" }`, `{ tag_name: "v1", published_at: "nope" }`.
  - `button links to the releases page`: `a.cta` href equals the releases URL and its text contains "Download on GitHub"; it contains `small[data-latest]` with the `hidden` attribute.
  - `copy matches the spec`: document text contains the kicker, "You see who's", the `h1 span` text is "under the radar", the one line, "desktop", and `footer` contains "Not affiliated with Yahoo or the NBA."
  - `link preview tags`: `og:url` is `https://hoopradar.pages.dev/`; `og:image` and `twitter:image` are `https://hoopradar.pages.dev/og.png`; `twitter:card` is `summary_large_image`; `og:title`, `og:description`, `meta[name=viewport]` present.
  - `only GitHub API is contacted`: no `script[src]` other than relative ones; every `link[href]` relative; every `img[src]` relative; `styles.css` has no `http` inside `url(` and no `@import`; across all `site/` `.html` and `.js` files, every `https://` URL other than the releases URL, repo URL, `https://hoopradar.pages.dev/...` and `https://api.github.com/repos/ccc1236/hoopradar/releases/latest` appears only in `<a href>` (in practice: none).
  - `no dashes`: no file in `siteFiles()` with `.html`, `.css`, `.js`, `.svg`, `.md` contains U+2013 or U+2014 (escape them in the regex source).
  - `reduced motion`: `styles.css` contains `prefers-reduced-motion: reduce`.
  - `logo ends on the shipped logo`: inside `svg.logo`: `path[d="M 24 80 Q 64 -18 104 80"]`, `circle[cx="64"][cy="16"][r="5"]`, `circle[cx="64"][cy="96"][r="7"]`, `line[x1="48"][y1="108"][x2="80"][y2="108"]`.

- [ ] **Step 2: Run** `npx vitest run test/unit/site.test.ts`. Expected: FAIL (cannot resolve `site/version.js`).

- [ ] **Step 3: Implement.**
  - `site/leather.svg`: copy of `.superpowers/brainstorm/pebble-tile.svg`; CSS shows it at `0 0/240px 240px` over `#b9521f`, with `box-shadow: inset 0 0 26px rgba(70,22,4,.55)`.
  - `site/favicon.svg`: copy of `docs/logo-samples/D-bluemoon-gradient.svg`.
  - `site/version.js`: `formatLatest` plus an `init()` run on load that fetches the API URL (`Accept: application/vnd.github+json`), passes JSON to `formatLatest`, and if non-null sets the `small[data-latest]` text and removes `hidden`; any error leaves it hidden. Loaded with `<script type="module" src="version.js">`. Format the date with `toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })`.
  - `site/index.html` and `site/styles.css`: port `.superpowers/brainstorm/splash-v9.html` (layout, leather bars with `#1b1310` seams, whiteboard gradient, large sketch on the right that draws in once and stays, faded behind text under 1000px) with these changes: copy per Global Constraints; `.brand` logo replaced by the animated logo from card 1 of `.superpowers/brainstorm/130-1792813655/content/logo-anim.html` (as `svg.logo`, unique gradient id); kicker as a bold `p.kicker` above the `h1`; a small note under the button such as "Free and open source. Installs on desktop Chrome, Edge or Brave."; head tags per the test; use `min-height: 100svh` with fallback `100vh` so it fills phone screens and scrolls vertically when content is taller. Reduced-motion block shows all final frames and hides the logo's play group.
  - `site/README.md`: what the folder is; Cloudflare Pages settings (connect the GitHub repo, production branch `main`, framework preset None, build command empty, output directory `site`, project name `hoopradar`); local preview (`npx serve site`, since `type="module"` scripts do not run from `file://`); domain move: edit `og:url`, `og:image`, `twitter:image` in `index.html`; regenerating `og.png` (`node scripts/render-og.mjs`) and `leather.svg` (generated tile, edit by hand or replace).

- [ ] **Step 4: Run** the site test. Expected: PASS.

- [ ] **Step 5: Run** `npm run typecheck && npm test && npm run build`. Expected: all pass; `dist/` contains no site files.

- [ ] **Step 6: Commit** `feat(site): single-screen landing page`.

### Task 2: README additions and mock screenshots

**Files:**
- Create: `docs/images/stats-table.svg`, `docs/images/radar-card.svg`
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing from Task 1 except the site address.

- [ ] **Step 1: Make the images.**
  - `docs/images/stats-table.svg`: generic stats table (not Yahoo's UI), about 6 made-up players (J. Marlow, D. Okafor-Reyes, T. Lindqvist, and similar), columns Player, MIN, PTS, REB, AST, eFG%, TS%, USG%. Cell fills use the exact stops from `src/content/shading.ts` (quality `#ef9a9a #f5bf94 #f9e595 #b5d9a2 #7dbb88`, usage `#eceffa #d6dbf3 #bfc8ec #a6b1e3 #8d9ada`); one low-minutes row with the small dark dot on its USG% cell. Text as SVG text in a system font, no external refs.
  - `docs/images/radar-card.svg`: dark card like the tooltip, nine axes clockwise from 12 o'clock labelled 3PM, PTS, REB, AST, STL, BLK, TO (with down arrow), TS%, USG% (`src/shared/spiderAxes.ts`), rings `rgba(255,255,255,.08)`, polygons season `#9CA3AF` fill-opacity .18, L10 `#0ABAB5` .22, L5 `#F59E0B` .30 (`src/ui/spider-chart.ts`), legend, made-up player name.

- [ ] **Step 2: Edit `README.md`** per the spec's "README changes": link to `https://hoopradar.pages.dev` under the title; both images near the top with an "illustrative, made-up players" caption; "What it does on the page" led by the four headline features; Install adds the developer-mode warning note and "then open your league's Players or My Team page"; Updating adds no auto-update plus "Watch > Custom > Releases"; new "FAQ" section with the seven questions, absorbing overlapping bullets from "Things to know before installing" (keep that section for what is left, or fold it entirely if nothing remains). Facts must match the existing README and `CHANGELOG.md`.

- [ ] **Step 3: Verify.** Images open in the browser and look right; README has no U+2013/U+2014 (`rg "[\x{2013}\x{2014}]" README.md docs/images` returns nothing); the three-command chain passes.

- [ ] **Step 4: Commit** `docs: README screenshots, FAQ and install notes moved from the landing page`.

### Task 3: Preview image and final checks

**Files:**
- Create: `scripts/render-og.mjs`, `site/og.svg`, `site/og.png`
- Test: `test/unit/site.test.ts`

**Interfaces:**
- Consumes: `siteFiles()` from Task 1; `og:image` URL `https://hoopradar.pages.dev/og.png`.

- [ ] **Step 1: Add failing test** `preview image is 1200x630`: `site/og.png` exists and its IHDR width/height (bytes 16 to 23, big-endian) are 1200 and 630.

- [ ] **Step 2: Run** the site test. Expected: FAIL (ENOENT).

- [ ] **Step 3: Implement.** `site/og.svg`: 1200x630, leather strips top and bottom (embed the tile as a `<pattern>` from `leather.svg` contents, since sharp cannot load external files), whiteboard middle, static logo, kicker and headline in the page's colours and a system sans font. `scripts/render-og.mjs`: `sharp(svg, { density: 144 }).resize(1200, 630).png()` to `site/og.png`, header comment in the style of `scripts/rasterize-icons.mjs`. Run it and check the PNG visually.

- [ ] **Step 4: Run** the site test. Expected: PASS.

- [ ] **Step 5: Browser checks** with `npx serve site` in the browser pane:
  - 1440x900 and 1366x650: everything visible, logo animation plays once and ends on the clean logo, sketch draws on the right, version line shows "Latest: v0.2.5, released 24 Oct 2026" (or the newer real release).
  - 360x640: `document.documentElement.scrollWidth <= 360`, text readable over the faded sketch, button reachable.
  - Failure path: block or break the API URL (DevTools request blocking or a temporary bad URL) and reload: button shows without the version line.
  - Reduced motion emulated: final frames immediately.
  - Button opens the releases page.

- [ ] **Step 6: Run** the chain, commit `feat(site): link preview image`.
