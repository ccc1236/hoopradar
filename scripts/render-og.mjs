// Rasterize the landing page's link preview image.
//
// - site/og.svg -> site/og.png (1200x630, used by og:image and twitter:image)
//
// Run: node scripts/render-og.mjs

import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const siteDir = join(resolve(__dirname, ".."), "site");

const svg = await readFile(join(siteDir, "og.svg"));
await sharp(svg, { density: 144 }).resize(1200, 630).png().toFile(join(siteDir, "og.png"));
console.log("Wrote site/og.png");
