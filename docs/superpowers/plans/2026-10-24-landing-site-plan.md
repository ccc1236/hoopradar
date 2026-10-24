# HoopRadar Landing Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A one-page static site in `site/` that introduces HoopRadar, links prominently to the GitHub releases page, and explains install, updating and limitations, deployable to Cloudflare Pages with no build step.

**Architecture:** One `site/index.html` with inline SVG (animated logo, whiteboard sketch, mock radar card) and one `site/styles.css`. A Vitest guard test parses the HTML with `jsdom` and checks the requirements that can silently regress (links, meta tags, no external requests, no dashes, sections present). The preview image is rendered once from an SVG with `sharp` by a manual script, like `scripts/rasterize-icons.mjs`.

**Tech Stack:** HTML, CSS, SVG; Vitest + jsdom (already dev dependencies) for the guard test; sharp for the one-off PNG.

**Spec:** `docs/superpowers/specs/2026-10-24-landing-site-design.md`

## Global Constraints

- Everything for the site lives in `site/`, except the guard test (`test/unit/site.test.ts`) and the preview renderer (`scripts/render-og.mjs`). Nothing under `src/` or `public/`; `vite.config.ts`, `manifest.json` and `package.json` unchanged.
- No em dash (U+2014) or en dash (U+2013) in any file under `site/`, in the test, the script, or commit messages.
- No external requests from the page: no `<script src>`, no stylesheet, font, image or `url()` from another origin. Plain `<a href>` links to other sites are fine. No analytics. System font stack.
- Releases URL, exactly: `https://github.com/ccc1236/hoopradar/releases`
- Repo URL: `https://github.com/ccc1236/hoopradar`; changelog: `https://github.com/ccc1236/hoopradar/blob/main/CHANGELOG.md`
- Site address: `https://hoopradar.pages.dev` (used only in `og:url`, `og:image`, `twitter:image`).
- Colours: background `#10151f`, accent `#ff8a3d`, logo gradient `#4A6E84 -> #2D4A5B -> #1F3645`, whiteboard ink `#2D4A5B`.
- Footer text, exactly: "HoopRadar is an independent project, not affiliated with Yahoo or the NBA."
- No Yahoo, NBA or team logos; no real screenshots; no real league, team or manager names; no divac mark.
- Do not mention why it is not on the Chrome Web Store beyond "Not on the Chrome Web Store yet".
- No horizontal scroll at 360px width; 16px side gutters; animations honour `prefers-reduced-motion: reduce` by showing the final frame.
- Feature facts must match `README.md` and `CHANGELOG.md`.
- Commits as `ccc1236 <145925203+ccc1236@users.noreply.github.com>` (repo default), ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Before every commit: `npm run typecheck`, `npm test`, `npm run build` all pass.

## Review Focus

1. Phone width (360px): the mock stats table is wider than the screen. Expected: the table scrolls inside its own container, the page itself never scrolls sideways. Checked in Task 5 Step 3 (browser, `document.documentElement.scrollWidth <= 360`).
2. Reduced motion: someone with reduced motion on must see the finished logo and whiteboard immediately, not a blank tile. Guard test asserts the `prefers-reduced-motion` rule exists (Task 1); visual check in Task 5.
3. Link preview on X: relative or wrong-host `og:image` gives a card with no image and no local symptom. Guard test asserts absolute URLs on the agreed host and that the image file exists (Task 1 and Task 5).
4. Visitor on a phone tapping "Download": the extension is desktop only. Expected: a short note near the button that it installs on desktop Chrome, Edge or Brave. Asserted in Task 1's test.
5. Logo final frame drifting from the shipped logo: after the animation the mark must match `docs/logo-samples/D-bluemoon-gradient.svg` (same path `d`, circle positions, line). Guard test compares the attributes (Task 1).

---

### Task 1: Guard test, page shell, hero with animated logo, footer

**Files:**
- Create: `test/unit/site.test.ts`
- Create: `site/index.html`, `site/styles.css`, `site/favicon.svg`, `site/README.md`

**Interfaces:**
- Produces: `site/index.html` structure later tasks fill in: `<header class="hero">`, then `<main>` holding `<section id="what">`, `<section id="see">`, `<section id="install">`, `<section id="update">`, `<section id="faq">` (empty placeholders with an `<h2>` each are fine in this task), then `<footer>`.
- Produces: in the test file, helpers `loadDoc(): Document` (reads `site/index.html`, returns `new JSDOM(html).window.document`) and `siteFiles(): string[]` (all files under `site/`, recursive). Later tasks append `it(...)` blocks using them.
- Produces CSS custom properties on `:root`: `--bg`, `--fg`, `--muted`, `--accent`, `--card`, `--ink`.

- [ ] **Step 1: Write the failing test** `test/unit/site.test.ts` (node environment; `import { JSDOM } from "jsdom"`; read files with `node:fs`). Tests:
  - `hero links to the releases page`: `doc.querySelector(".hero a.cta")?.getAttribute("href")` equals the releases URL.
  - `hero notes desktop only`: `.hero` textContent matches `/desktop/i`.
  - `has every section`: ids `what`, `see`, `install`, `update`, `faq` each exist and contain an `h2`.
  - `footer carries the non-affiliation note`: `footer` textContent contains the exact footer text.
  - `link preview tags are absolute on the agreed host`: `meta[property="og:url"]` content is `https://hoopradar.pages.dev/`; `og:image` and `meta[name="twitter:image"]` start with `https://hoopradar.pages.dev/`; `meta[name="twitter:card"]` is `summary_large_image`; `og:title` and `og:description` non-empty; `meta[name="viewport"]` exists.
  - `makes no external requests`: no `script[src]`; every `link[href]` except `rel="canonical"` is a relative path; every `img[src]`, `source[src]`, `[style*="url("]` is relative; `styles.css` contains no `url(` with `http` and no `@import`.
  - `contains no em or en dashes`: for every file in `siteFiles()` with extension `.html`, `.css`, `.svg`, `.md`, content does not match a regex of the two code points U+2013 and U+2014 (write them as escapes in the test source, never literally).
  - `honours reduced motion`: `styles.css` contains `prefers-reduced-motion: reduce`.
  - `animated logo ends on the shipped logo`: in `.hero svg.logo`, a `path` with `d="M 24 80 Q 64 -18 104 80"`, a `circle` with `cx="64" cy="16" r="5"`, a `circle` with `cx="64" cy="96" r="7"`, and a `line` with `x1="48" y1="108" x2="80" y2="108"` all exist.

- [ ] **Step 2: Run** `npx vitest run test/unit/site.test.ts`. Expected: FAIL, ENOENT for `site/index.html`.

- [ ] **Step 3: Build the shell.**
  - `site/favicon.svg`: copy of `docs/logo-samples/D-bluemoon-gradient.svg`.
  - `site/index.html`: `<!doctype html>`, `lang="en"`, charset, viewport, `<title>HoopRadar - advanced stats for Yahoo Fantasy Basketball</title>`, meta description, Open Graph and Twitter tags per the test (image `https://hoopradar.pages.dev/og.png`, 1200x630, with `og:image:width/height` and alt), favicon link, `styles.css`.
  - Hero: the animated logo as inline `<svg class="logo" viewBox="0 0 128 128" role="img" aria-label="HoopRadar logo">`, ported from card 1 of `.superpowers/brainstorm/130-1792813655/content/logo-anim.html` (tile fades in, backboard, hoop, arc draw via `pathLength="1"` dash offset, ball pops, orange X's and white pass and cut play draw in then fade out, about 5 s, plays once). Gradient id must not collide with the whiteboard's ids in Task 2. Beside or under it: an `h1` (start from "See who's <span>actually</span> good."), one line saying it is a free Chrome extension that adds advanced stats to Yahoo Fantasy Basketball's Players and My Team pages, the `a.cta` "Download from GitHub", and a small note such as "Free, open source. Installs on desktop Chrome, Edge or Brave."
  - Footer: links to the repo, the changelog, "MIT licence", and the footer text.
  - `site/styles.css`: tokens above, system font stack, mobile-first layout with 16px gutters and a max content width around 1040px, hero stacks on phones and goes side by side from about 720px. Animation classes (`.d` draw, `.pop`, `.fade`, `.play` fade-out) live here, plus a `@media (prefers-reduced-motion: reduce)` block that removes animations and shows final states (the play group hidden, everything else visible).
  - `site/README.md`: what the folder is; Cloudflare Pages settings (connect the GitHub repo, production branch `main`, framework preset None, build command empty, build output directory `site`); local preview (open `site/index.html`, or `npx serve site`); to change the domain, edit the three meta tags `og:url`, `og:image`, `twitter:image` in `index.html`; how to regenerate `og.png` (`node scripts/render-og.mjs`, added in Task 5).

- [ ] **Step 4: Run** `npx vitest run test/unit/site.test.ts`. Expected: PASS, all listed tests green (sections can be placeholders).

- [ ] **Step 5: Run** `npm run typecheck && npm test && npm run build`. Expected: all pass, `dist/` contains no `site` files.

- [ ] **Step 6: Commit** `feat(site): landing page shell with animated logo hero`.

### Task 2: "What it does" with the whiteboard sketch

**Files:**
- Modify: `site/index.html` (`#what`), `site/styles.css`
- Test: `test/unit/site.test.ts`

**Interfaces:**
- Consumes: `loadDoc()`, `#what` section, CSS tokens from Task 1.

- [ ] **Step 1: Add failing test** `what section lists the four features beside the whiteboard`: `#what svg.whiteboard` exists; `#what li` count is 4; `#what` textContent contains `eFG%`, `TS%`, `USG%`, `Last 5`, `Last 10`, `Per 36`, `Per 100`, and matches `/radar/i`.

- [ ] **Step 2: Run** the site test. Expected: FAIL on `svg.whiteboard`.

- [ ] **Step 3: Implement.** Whiteboard SVG ported from card 2 of the mockup file (off-white board, turbulence/displacement filter, ink `#2D4A5B`, orange-red X's, play stays drawn); unique ids. Four points, facts per the spec's "What it does" list (shaded columns with small-sample dot; L5/L10 are games the player played, unlike Yahoo's day-based filter; Per 36 / Per 100 as well as Per Game; hover radar card comparing Season, L10 and L5, click to pin). Two columns from about 720px, stacked on phones. Optional: start the sketch's draw animation when it scrolls into view with a tiny inline `IntersectionObserver` that adds a class; without JS or with reduced motion, the final frame shows.

- [ ] **Step 4: Run** the site test. Expected: PASS.

- [ ] **Step 5: Run** the three-command chain, then commit `feat(site): what-it-does section with whiteboard sketch`.

### Task 3: "See it" mock table and radar card

**Files:**
- Modify: `site/index.html` (`#see`), `site/styles.css`
- Test: `test/unit/site.test.ts`

**Interfaces:**
- Consumes: `loadDoc()`, `#see`.

- [ ] **Step 1: Add failing tests.**
  - `see section shows a shaded mock table`: `#see table` exists, has header cells with text `eFG%`, `TS%`, `USG%`, and at least one `td` whose inline `style` background is one of the extension's stops (see Step 3).
  - `mock data is labelled illustrative`: `#see` textContent matches `/illustrative|made up/i`.
  - `see section shows a mock radar card`: `#see svg.radar` exists with 3 data `polygon` elements tagged `data-window="season"`, `"L10"`, `"L5"`.

- [ ] **Step 2: Run** the site test. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - Table: generic stats table (not a copy of Yahoo's UI), 5 to 6 made-up players (for example J. Marlow, D. Okafor-Reyes, T. Lindqvist), columns Player, MIN, PTS, REB, AST, eFG%, TS%, USG%, wrapped in a container with `overflow-x: auto`. Shading from `src/content/shading.ts`: quality stops `#ef9a9a #f5bf94 #f9e595 #b5d9a2 #7dbb88` for eFG%/TS%, usage stops `#eceffa #d6dbf3 #bfc8ec #a6b1e3 #8d9ada` for USG%, used as exact stop values on cells. One low-minutes row gets the small-sample dot on its USG% cell with a `title` like "Small sample: 2 of 12 team games, 6.0 MPG".
  - Radar card: dark card styled like the tooltip, nine axes clockwise from 12 o'clock with labels from `src/shared/spiderAxes.ts` (3PM, PTS, REB, AST, STL, BLK, TO, TS%, USG%; write "TO" plus a down arrow as in the source), rings in `rgba(255,255,255,.08)`, polygons coloured per `src/ui/spider-chart.ts`: season `#9CA3AF` fill opacity .18, L10 `#0ABAB5` .22, L5 `#F59E0B` .30, legend Season / L10 / L5.
  - Caption: players and numbers are illustrative.

- [ ] **Step 4: Run** the site test. Expected: PASS.

- [ ] **Step 5: Run** the chain, commit `feat(site): mock stats table and radar card`.

### Task 4: Install, Updating, FAQ

**Files:**
- Modify: `site/index.html` (`#install`, `#update`, `#faq`), `site/styles.css`
- Test: `test/unit/site.test.ts`

**Interfaces:**
- Consumes: `loadDoc()`.

- [ ] **Step 1: Add failing tests.**
  - `install has four steps and links to releases`: `#install ol > li` count is 4; `#install a[href="https://github.com/ccc1236/hoopradar/releases"]` exists; textContent contains `chrome://extensions`, `Developer mode`, `Load unpacked`, and matches `/stay/i` (folder must stay put).
  - `update explains unzip over the same folder`: `#update` textContent matches `/same folder/i`, contains `reload`, and matches `/Watch/`.
  - `faq answers the expected questions`: `#faq details` count is at least 7, and summaries together match `/free/i`, `/data/i`, `/browser/i`, `/match Yahoo/i`, `/slow/i`, `/ESPN/i`, `/Chrome Web Store/i`.
  - `does not explain the store absence`: whole document text does not match `/\b(headers?|Akamai|bot|spoof\w*)\b/i`.

- [ ] **Step 2: Run** the site test. Expected: FAIL.

- [ ] **Step 3: Implement** using the spec's "Install in 2 minutes", "Updating" and "FAQ" sections verbatim for facts, in plain language. FAQ as `<details><summary>` items. Install also notes the developer-mode warning Chrome may show and "then open your league's Players or My Team page". Updating suggests "Watch > Custom > Releases" on the GitHub repo.

- [ ] **Step 4: Run** the site test. Expected: PASS.

- [ ] **Step 5: Run** the chain, commit `feat(site): install, updating and FAQ sections`.

### Task 5: Preview image and final checks

**Files:**
- Create: `scripts/render-og.mjs`, `site/og.svg`, `site/og.png`
- Test: `test/unit/site.test.ts`

**Interfaces:**
- Consumes: the `og:image` URL from Task 1 (`https://hoopradar.pages.dev/og.png`).

- [ ] **Step 1: Add failing test** `preview image exists at 1200x630`: `site/og.png` exists, and its PNG IHDR width and height (bytes 16 to 23, big-endian) are 1200 and 630.

- [ ] **Step 2: Run** the site test. Expected: FAIL, ENOENT.

- [ ] **Step 3: Implement.** `site/og.svg`: 1200x630, background `#10151f`, the static logo tile (final frame) on the left, headline and one line on the right in a system sans font, orange accent. `scripts/render-og.mjs`: reads `site/og.svg`, writes `site/og.png` with `sharp(svg, { density: 144 }).resize(1200, 630).png()`; header comment in the style of `scripts/rasterize-icons.mjs`. Run `node scripts/render-og.mjs`.

- [ ] **Step 4: Run** the site test. Expected: PASS.

- [ ] **Step 5: Browser checks** (open `site/index.html` in the browser pane):
  - At 360x800: `document.documentElement.scrollWidth <= 360`; hero, sections and footer readable; the table scrolls inside its box.
  - At desktop width: hero side by side, logo animation plays once and ends on the clean logo, whiteboard beside the feature list.
  - With reduced motion emulated (or by temporarily checking the CSS rule in DevTools): logo and whiteboard show final frames immediately.
  - The hero button opens the releases page.
  - Check `og.png` visually.

- [ ] **Step 6: Run** the chain, commit `feat(site): link preview image`.
