# HoopRadar landing site - design

Date: 2026-10-24
Status: approved by the user 2026-10-24

## Intent

A one-page website that explains HoopRadar on sight and gets a visitor from "what is this?" to "it's running on my Yahoo page" without help.

Audience, in order: the user's Yahoo league mates first, then people who tap a link in a post on X and spread it by word of mouth. Nobody will walk them through it. The user has shared the extension with league mates before and heard nothing back, so the page has to do the explaining and the selling itself. A post on X gets a second or two of attention, so the top of the page and the link preview card matter most.

Success: someone who has never heard of HoopRadar lands on the page, understands what it adds to Yahoo Fantasy Basketball within a few seconds, and can install it by following the page alone.

## Goals

- Introduce HoopRadar and show what it looks like on a Yahoo page.
- A prominent link to the GitHub releases page: https://github.com/ccc1236/hoopradar/releases
- Install and update steps a non-developer can follow.
- A short FAQ covering the questions a stranger would have.
- A good-looking link preview when posted on X (Open Graph and Twitter card tags plus a preview image).
- Works well at phone width (people tapping from X are mostly on phones), even though the extension itself is desktop only.

## Non-goals

- No Chrome Web Store listing, auto-update, analytics, sign-up, newsletter, or comments.
- No blog, docs site, multi-page navigation, or changelog mirror (link to GitHub instead).
- No build step, framework, or package dependencies for the site.

## Anti-goals (would make it a failure even if it works)

- Implying affiliation with Yahoo or the NBA: no Yahoo, NBA or nba.com logos, team logos, or league branding. Plain text names only where needed to say what it works with.
- Real screenshots or any real team names, manager names, or personal info from the user's league.
- Using the divac project's mark or animation. That belongs to divac only.
- Exposing the reason it is not on the Chrome Web Store (the nba.com request-header workaround documented in `docs/ROADMAP.md`). The page says only "Not on the Chrome Web Store yet."
- Putting the user's real name or email anywhere (the repo is public).
- Em or en dashes anywhere in page copy, code comments, or commits (house rule). Use commas, colons, parentheses or " - ".
- Overstating what it does. Feature wording must match `README.md` and `CHANGELOG.md`.

## Constraints

- **Location:** a new top-level `site/` folder in this repo. Nothing under `src/`, `public/`, or anything the extension build (`vite.config.ts`, `npm run build`, `npm run package`) reads. The extension build and tests must be unaffected.
- **Hosting:** Cloudflare Pages, connected to the GitHub repo, build command empty, output directory `site`. The user sets up the Cloudflare project; the builder only produces the folder and notes the settings in `site/README.md`.
- **Tech:** plain static HTML and CSS, small inline or local JS only if needed (for example the animation replay or nothing at all). No external scripts. No third-party requests at all (no web fonts from CDNs, no analytics), consistent with HoopRadar's "collects nothing" stance. Use a system font stack.
- **Accessibility:** animation honours `prefers-reduced-motion` (show the final state). Sufficient contrast on the dark background. Real text, not text in images.
- **Phone width:** no horizontal scroll at 360px; 16px side gutters.

## Decided with the user

### Look: "dark court" (option A from the mockups)
Dark night-game background (around `#10151f`), light text, orange accent (around `#ff8a3d`) for the headline highlight and the main button. White tables/cards sit on the dark background.

### Hero (top of page)
- The **animated HoopRadar logo** (animation 1 from the mockups): on the blue moon tile (`docs/logo-samples/D-bluemoon-gradient.svg`, radial gradient `#4A6E84 -> #2D4A5B -> #1F3645`), the backboard line draws, then the hoop ring, then the 3-point arc in one marker-like stroke, then the ball pops in at the top. Orange X defenders and a white pass-and-cut play (O's, a pass line, a cut line with an arrowhead to the hoop) sketch in, then fade away, leaving the clean logo. Plays once, about 5 seconds. Pure SVG + CSS. Reference implementation: `.superpowers/brainstorm/130-1792813655/content/logo-anim.html` (card 1). That folder is git-ignored scratch, so the builder copies what it needs into `site/`; the final state must match the shipped logo exactly.
- A short punchy headline (mockup used "See who's *actually* good." with "actually" in orange), one line saying what it is (free Chrome extension that adds advanced stats to Yahoo Fantasy Basketball's Players and My Team pages), and a big orange button "Download from GitHub" linking to the releases page.

### "What it does" section, beside the whiteboard sketch
- Illustration: the **whiteboard sketch** (animation 2 from the mockups): off-white board, slightly wobbly marker lines (SVG turbulence/displacement filter) in the logo blue `#2D4A5B`, orange-red X's, and the same play drawn in. The play stays drawn. Reference: same mockup file, card 2. Animating it when scrolled into view is the builder's call; a static final frame is acceptable.
- Four points:
  1. eFG%, TS% and USG% columns, colour shaded (red to green for efficiency vs league average, a blue scale for usage, a dot for small samples).
  2. Last 5 / Last 10 game windows (games the player actually played, unlike Yahoo's day-based filter).
  3. Per 36 and Per 100 possessions modes, as well as Per Game.
  4. Hover any player for a radar card comparing Season, L10 and L5; click to pin it.

### "See it" section
Mock-ups, not screenshots: a Yahoo-style stats table (styled generically, not a copy of Yahoo's UI) with the shaded eFG%/TS%/USG% columns, and a mock of the radar card. Made-up player names (for example "J. Marlow", "D. Okafor-Reyes", "T. Lindqvist") and plausible made-up numbers. Shading colours should follow the real extension's scheme (pastel red/yellow/green, light-to-deeper blue for USG%), taken from `src/content/shading.ts`. The radar card's axes and colours come from `src/shared/spiderAxes.ts` and `src/ui/spider-chart.ts`. A small caption says the players and numbers are illustrative.

### "Install in 2 minutes"
The four steps from `README.md` (download the latest `hoopradar-vX.Y.Z.zip`, unzip somewhere permanent, enable Developer mode at `chrome://extensions`, Load unpacked and pick the `hoopradar` folder), in plain language. Plus:
- The unzipped folder must stay put (do not leave it in Downloads and tidy up later).
- Chrome may show a warning about developer-mode extensions; that is expected for extensions installed this way.
- Then open your league's Players or My Team page.

### "Updating"
Unzip the new version over the same folder, then click the reload arrow on the HoopRadar card in `chrome://extensions`. Keep the same folder, or Chrome treats it as a new extension and settings are lost. There is no auto-update, so suggest "Watch > Custom > Releases" on the GitHub repo to hear about new versions.

### FAQ
- Is it free? Yes, free and open source (MIT).
- Does it collect my data? No. It only requests stats from nba.com; nothing about you or your league leaves your browser.
- Which browsers? Chromium desktop browsers: Chrome, Edge, Brave. Not mobile, not Firefox or Safari.
- Why don't the numbers match Yahoo's? HoopRadar replaces Yahoo's displayed stats with nba.com numbers for the window and mode you pick; its windows are games played, Yahoo's are days.
- Why is the first load slow? Fresh data takes a few seconds, requests are deliberately spaced out, then cached for about 6 hours.
- Does it work on ESPN / Sleeper / other sites? No, Yahoo Fantasy Basketball only (Players and My Team pages).
- Is it on the Chrome Web Store? Not yet; install from GitHub as above.

### Footer
Links to the GitHub repo and `CHANGELOG.md`, MIT licence, and the note "HoopRadar is an independent project, not affiliated with Yahoo or the NBA."

### Link preview
Open Graph and Twitter card (`summary_large_image`) tags with title, description and a 1200x630 preview image (logo plus headline on the dark background), committed in `site/`. Favicon from the blue moon logo.

Site address: `https://hoopradar.pages.dev` (Cloudflare Pages project name `hoopradar`) for now. `hoopradar.com` is already taken, so a custom domain is undecided; the user may add one later. `og:image`, `twitter:image` and `og:url` need absolute URLs, so keep the address in as few places as possible (ideally only the `<head>` tags) and note in `site/README.md` exactly what to change when the domain moves.

## Left to the builder

- Exact headline and body copy (keep it short, plain, a bit of fantasy-basketball voice; match README facts).
- Layout details, spacing, typography within the system font stack.
- How the preview PNG is produced (for example a hand-written SVG rasterised once with the existing `sharp` dev dependency via a throwaway script, or a browser screenshot). The PNG is committed; no build step at deploy time.
- Whether the whiteboard sketch animates on scroll.
- Verification: open the page locally at desktop and 360px widths, check the releases link, reduced-motion behaviour, and that `npm run typecheck`, `npm test` and `npm run build` still pass (the site must not affect them).
