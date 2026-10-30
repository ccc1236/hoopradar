# HoopRadar landing page

The single-screen splash served at https://hoopradar.app. Plain HTML, CSS and one small script; no build step. It is not part of the extension build.

Design: `docs/superpowers/specs/2026-10-24-landing-site-design.md`.

## Files

- `index.html`: the page, with the animated logo and the whiteboard sketch as inline SVG.
- `styles.css`: layout, colours and the draw-in animations (reduced-motion users see the final frames).
- `version.js`: fills "Latest: vX.Y.Z, released ..." under the button from `https://api.github.com/repos/ccc1236/hoopradar/releases/latest`, the page's only network request. If it fails, the line stays hidden. `version.d.ts` types it for the test.
- `leather.svg`: generated pebbled-leather tile for the top and bottom bars.
- `favicon.svg`: the blue moon logo.
- `og.png`: the link preview image (see below).

Checked by `test/unit/site.test.ts` (part of `npm test`).

## Cloudflare Pages

1. Workers & Pages > Create > Pages > Connect to Git, pick `ccc1236/hoopradar`.
2. Project name `hoopradar`, production branch `main`, framework preset None, build command empty, build output directory `site`.
3. After the first deploy: Custom domains > Set up a domain > `hoopradar.app`. Cloudflare adds the DNS record and the HTTPS certificate. `hoopradar.pages.dev` keeps working as a fallback.

Every push to `main` redeploys.

## Local preview

```bash
npx serve site
```

Opening `index.html` straight from disk also works, except the version line (module scripts do not run from `file://`).

## Changing the domain

Edit the three absolute URLs in `index.html`: `og:url`, `og:image` and `twitter:image`, and the expected values in `test/unit/site.test.ts`.

## Regenerating the preview image

```bash
node scripts/render-og.mjs
```
