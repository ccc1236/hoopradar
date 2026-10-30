import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { formatLatest } from "../../site/version.js";

const SITE = join(__dirname, "..", "..", "site");
const RELEASES = "https://github.com/ccc1236/hoopradar/releases";

function loadDoc(): Document {
  return new JSDOM(readFileSync(join(SITE, "index.html"), "utf8")).window.document;
}

function siteFiles(dir = SITE): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? siteFiles(p) : [p];
  });
}

const css = (): string => readFileSync(join(SITE, "styles.css"), "utf8");

describe("formatLatest", () => {
  it("formats a release", () => {
    expect(formatLatest({ tag_name: "v0.2.5", published_at: "2026-10-24T09:00:00Z" })).toBe(
      "Latest: v0.2.5, released 24 Oct 2026",
    );
  });

  it("rejects bad input", () => {
    expect(formatLatest(null)).toBeNull();
    expect(formatLatest({})).toBeNull();
    expect(formatLatest({ message: "Not Found" })).toBeNull();
    expect(formatLatest({ tag_name: "v1", published_at: "nope" })).toBeNull();
  });
});

describe("landing page", () => {
  it("button links to the releases page", () => {
    const cta = loadDoc().querySelector("a.cta");
    expect(cta?.getAttribute("href")).toBe(RELEASES);
    expect(cta?.textContent).toContain("Download on GitHub");
    expect(cta?.querySelector("small[data-latest]")?.hasAttribute("hidden")).toBe(true);
  });

  it("copy matches the spec", () => {
    const doc = loadDoc();
    const text = doc.body.textContent ?? "";
    expect(text).toContain("Your league sees points.");
    expect(text).toContain("You see who's");
    expect(doc.querySelector("h1 span")?.textContent).toBe("under the radar");
    expect(text).toContain(
      "A free Chrome extension that puts eFG%, TS%, USG% and Last 5 / Last 10 form on your Yahoo Fantasy Basketball pages.",
    );
    expect(text).toMatch(/desktop/i);
    expect(doc.querySelector("footer")?.textContent).toContain("Not affiliated with Yahoo or the NBA.");
  });

  it("link preview tags", () => {
    const doc = loadDoc();
    const meta = (sel: string) => doc.querySelector(sel)?.getAttribute("content");
    expect(meta('meta[property="og:url"]')).toBe("https://hoopradar.app/");
    expect(meta('meta[property="og:image"]')).toBe("https://hoopradar.app/og.png");
    expect(meta('meta[name="twitter:image"]')).toBe("https://hoopradar.app/og.png");
    expect(meta('meta[name="twitter:card"]')).toBe("summary_large_image");
    expect(meta('meta[property="og:title"]')).toBeTruthy();
    expect(meta('meta[property="og:description"]')).toBeTruthy();
    expect(doc.querySelector('meta[name="viewport"]')).not.toBeNull();
  });

  it("only GitHub API is contacted", () => {
    const doc = loadDoc();
    const isRelative = (u: string | null) => !!u && !/^[a-z]+:|^\/\//i.test(u);
    doc.querySelectorAll("script[src]").forEach((s) => expect(isRelative(s.getAttribute("src"))).toBe(true));
    doc.querySelectorAll("link[href]").forEach((l) => expect(isRelative(l.getAttribute("href"))).toBe(true));
    doc.querySelectorAll("img[src]").forEach((i) => expect(isRelative(i.getAttribute("src"))).toBe(true));
    expect(css()).not.toMatch(/url\(\s*["']?https?:/i);
    expect(css()).not.toMatch(/@import/i);
    const allowed = [
      RELEASES,
      "https://github.com/ccc1236/hoopradar",
      "https://hoopradar.app/",
      "https://hoopradar.app/og.png",
      "https://api.github.com/repos/ccc1236/hoopradar/releases/latest",
    ];
    for (const f of siteFiles().filter((p) => /\.(html|js)$/.test(p))) {
      const urls = readFileSync(f, "utf8").match(/https?:\/\/[^\s"'`)<>]+/g) ?? [];
      // SVG namespace URIs are identifiers, not requests.
      for (const u of urls.filter((u) => !u.startsWith("http://www.w3.org/"))) expect(allowed).toContain(u);
    }
  });

  it("contains no em or en dashes", () => {
    for (const f of siteFiles().filter((p) => /\.(html|css|js|svg|md)$/.test(p))) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/[–—]/);
    }
  });

  it("honours reduced motion", () => {
    expect(css()).toContain("prefers-reduced-motion: reduce");
  });

  it("logo ends on the shipped logo", () => {
    const logo = loadDoc().querySelector("svg.logo");
    expect(logo?.querySelector('path[d="M 24 80 Q 64 -18 104 80"]')).not.toBeNull();
    expect(logo?.querySelector('circle[cx="64"][cy="16"][r="5"]')).not.toBeNull();
    expect(logo?.querySelector('circle[cx="64"][cy="96"][r="7"]')).not.toBeNull();
    expect(logo?.querySelector('line[x1="48"][y1="108"][x2="80"][y2="108"]')).not.toBeNull();
  });
});
