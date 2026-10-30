# HoopRadar landing site - design

Date: 2026-10-24, revised 2026-10-30
Status: revision approved by the user 2026-10-30 (first version approved 2026-10-24)

## Intent

A plain, single-screen landing page for HoopRadar, in the spirit of a "coming soon" splash (the user's reference: coffeebeanbrunei.com, one full-bleed image, brand, headline, a row of links, no scrolling). It introduces HoopRadar in a glance and sends people to GitHub with one button.

Audience, in order: the user's Yahoo league mates, then people who tap a link in a post on X. Everything else (features, screenshots, install guide, updating, FAQ) lives on GitHub in the README, so the page stays a splash and the README is the manual.

Success: someone who taps the link understands in a few seconds what HoopRadar is and that it is free, sees the latest version, and taps through to GitHub.

## Revision note (2026-10-30)

The first version of this spec described a multi-section page (features, mock table and radar card, install, updating, FAQ). The user replaced that with a single-screen splash and moved all of that content to the README. The approved look (dark-court colours, orange accent, animated logo, whiteboard sketch) carries over, rearranged as below.

## Goals

- One screen, no scrolling at common desktop and phone sizes.
- One call to action: "Download on GitHub", linking to https://github.com/ccc1236/hoopradar/releases, showing the latest release version and date.
- A good link preview on X (Open Graph and Twitter card tags and a preview image).
- Works at phone width (most X traffic is phones) even though the extension is desktop only.
- The README carries everything the page dropped.

## Non-goals

- No other sections, links, navigation, social icons (an X or IG account may come later; leave room in the bottom bar), analytics, sign-up, or Chrome Web Store listing.
- No build step, framework, or package dependencies for the site.

## Anti-goals

- Implying affiliation with Yahoo or the NBA: no Yahoo, NBA or team logos or branding; ball textures show no maker logos or lettering.
- Real screenshots or real league, team or manager names anywhere (page or README images).
- Using the divac project's mark or animation.
- Explaining why it is not on the Chrome Web Store (the nba.com request-header workaround in `docs/ROADMAP.md`). At most "Not on the Chrome Web Store yet."
- Stock or downloaded images without a clear licence. The leather texture is generated in SVG, so there is none.
- The user's real name or email anywhere (public repo).
- Em or en dashes in any file or commit (house rule).
- Overstating features: wording matches `README.md` and `CHANGELOG.md`.

## Constraints

- **Location:** `site/` at the repo root. Nothing under `src/` or `public/`; the extension build, typecheck and tests are unaffected.
- **Hosting:** Cloudflare Pages, connected to the GitHub repo, no build command, output directory `site`, project name `hoopradar`, so the address is `https://hoopradar.pages.dev`. `hoopradar.com` is taken; a custom domain may come later. The user sets up the Cloudflare project.
- **External requests:** exactly one, from the visitor's browser to `https://api.github.com/repos/ccc1236/hoopradar/releases/latest`, for the version line (the user agreed to this). Nothing else: no CDN fonts, scripts, images or analytics. System font stack.
- **Accessibility:** animations honour `prefers-reduced-motion: reduce` by showing their final frames. Text contrast passes on both the whiteboard and the leather bars.
- **Phone width:** no horizontal scroll at 360px; 16px side gutters.

## Decided with the user

### Layout (mockup: `.superpowers/brainstorm/splash-v9.html`, git-ignored scratch)
A full-viewport page in three bands:

1. **Top bar:** a strip of basketball leather (about 48px tall) with a black seam line where it meets the whiteboard.
2. **Middle: the whiteboard** fills the rest of the screen. It's off-white (around `#f4f2ec`) with a soft light falloff. On the right, the coach's play is drawn large in wobbly marker: backboard, hoop, 3-point arc, ball, orange-red X defenders, O's, a pass line and a cut line with an arrowhead. It draws itself once on load, then stays. On narrow screens (under about 1000px) the sketch sits behind the text at low opacity.
   On the left, stacked:
   - the **HoopRadar logo with the wordmark "HoopRadar"**. The logo is animated: on the blue moon tile, backboard, hoop and arc draw in, the ball pops, then the orange X's and white play sketch in and fade out, ending on the exact shipped logo (`docs/logo-samples/D-bluemoon-gradient.svg`). About 5 seconds, plays once. Reference: card 1 of `.superpowers/brainstorm/130-1792813655/content/logo-anim.html`.
   - a small bold **kicker** "Your league sees points." above the **headline** "You see who's *under the radar*." with "under the radar" in orange (`#ff8a3d`), very large, ink colour around `#22313d`. The pitch is finding breakouts and waiver pickups before the rest of the league, and it plays on the name. (Chosen by the user from a side-by-side, `.superpowers/brainstorm/headlines.html`, third layout.)
   - **one line**: "A free Chrome extension that puts eFG%, TS%, USG% and Last 5 / Last 10 form on your Yahoo Fantasy Basketball pages."
   - the **button**: orange, label "Download on GitHub", with a smaller second line "Latest: v0.2.5, released 24 Oct 2026" filled in from GitHub. A small note near it that it installs on desktop Chrome, Edge or Brave.
3. **Bottom bar:** the same leather and seam, with the line "Not affiliated with Yahoo or the NBA." in cream text. Room for future social icons.

### Leather texture
Generated SVG tile (mockup source `.superpowers/brainstorm/pebble-tile.svg`), committed as a static file in `site/` and used as a repeating CSS background. Burnt-orange pebbles (`#b4471a`) in bright orange grooves (`#e5631d`), 5 or 6 sided (mostly hexagons), nearly uniform size with small corner, tilt and position jitter, soft specular highlight from the top left. The tile is drawn at 160px and displayed at 240px (the size the user approved). Inset shadow on the bars for depth.

### Version line
On load, a small inline script requests the latest release from the GitHub API and fills in `tag_name` and `published_at` (formatted like "24 Oct 2026"). If the request fails, is rate limited, or returns no release, the second line stays hidden and the button still works. The button always links to the releases page, not to a specific asset.

### Link preview
Open Graph and Twitter card (`summary_large_image`) tags: title, description, and a 1200x630 PNG (logo, kicker and headline, leather strip, whiteboard feel) committed in `site/`. `og:url`, `og:image` and `twitter:image` are absolute on `https://hoopradar.pages.dev`; `site/README.md` says exactly what to change if the domain moves. Favicon from the blue moon logo.

## README changes (the content the page dropped)

In `README.md` at the repo root:

- **Screenshots near the top:** two mock images in `docs/images/`, a generic stats table with shaded eFG%/TS%/USG% columns and a radar card, made-up players (for example J. Marlow, D. Okafor-Reyes, T. Lindqvist) and plausible numbers, captioned as illustrative. Shading colours from `src/content/shading.ts`; radar axes and colours from `src/shared/spiderAxes.ts` and `src/ui/spider-chart.ts`. SVG is fine (GitHub renders it in READMEs).
- **What it does:** tighten the existing section to the four headline features (shaded advanced columns with the small-sample dot; Last 5 / Last 10 game windows; Per 36 / Per 100; hover radar card comparing Season, L10 and L5, click to pin), keeping the existing detail.
- **Install:** keep the four steps; add that Chrome may warn about developer-mode extensions and that is expected, and "then open your league's Players or My Team page".
- **Updating:** keep as is; add that there is no auto-update, so use "Watch > Custom > Releases" on the repo to hear about new versions.
- **FAQ:** a new section: Is it free? Does it collect my data? Which browsers? Why don't the numbers match Yahoo's? Why is the first load slow? Does it work on ESPN or other sites? Is it on the Chrome Web Store? Fold in the overlapping bullets from "Things to know before installing" rather than repeating them.
- Add a link to the landing page near the top.

## Left to the builder

- Exact sizes, spacing and breakpoints within the layout above; making sure nothing overlaps at short laptop heights (for example 1366x650) and on phones.
- How the preview PNG is produced (for example an SVG rasterised once with the existing `sharp` dev dependency by a small script in `scripts/`).
- README wording, within the facts above.
- Verification: open the page at desktop and 360px widths, check the button link, the version line (and its failure path), reduced motion, and that `npm run typecheck`, `npm test` and `npm run build` still pass.
