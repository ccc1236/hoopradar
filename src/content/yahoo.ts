import type { YahooPlayer } from "../background/playerMapping.js";

const TEAM_POS_RE = /^([A-Z]{2,4})\s*-\s*[A-Z,]+/;

/**
 * Find the main stats table on a Yahoo Fantasy page. Strategy: pick the table
 * with the most player anchors (identified by `data-ys-playerid`). Robust to
 * Yahoo class renames; only assumes the player-anchor attribute name.
 */
export function findStatsTable(): HTMLTableElement | null {
  const tables = Array.from(document.querySelectorAll<HTMLTableElement>("table"));
  let best: { table: HTMLTableElement; count: number } | null = null;
  for (const t of tables) {
    const count = t.querySelectorAll("a[data-ys-playerid]").length;
    if (count >= 2 && (best === null || count > best.count)) {
      best = { table: t, count };
    }
  }
  return best?.table ?? null;
}

/**
 * Visual column a cell starts at, counting the colspans before it. Yahoo's
 * header rows can span body cells (e.g. one "Action" <th colspan=2> over the
 * trade and watch icons on another manager's team page), so a header's
 * position among its siblings is not the body cell index.
 */
export function columnOf(cell: Element): number {
  let col = 0;
  for (let c = cell.previousElementSibling; c; c = c.previousElementSibling) {
    col += (c as HTMLTableCellElement).colSpan || 1;
  }
  return col;
}

/** The cell in `row` that occupies visual column `col`, or null. */
export function cellAtColumn(row: Element, col: number): HTMLElement | null {
  let start = 0;
  for (const c of Array.from(row.children)) {
    const span = (c as HTMLTableCellElement).colSpan || 1;
    if (col < start + span) return c as HTMLElement;
    start += span;
  }
  return null;
}

/**
 * Scrape a player from a row. Skips rows that lack a player anchor, a valid
 * Yahoo player id, a non-empty name, or a recognizable team abbreviation.
 */
function scrapeRow(row: HTMLTableRowElement): YahooPlayer | null {
  const anchor = row.querySelector<HTMLAnchorElement>("a[data-ys-playerid]");
  if (!anchor) return null;
  const yahooId = anchor.getAttribute("data-ys-playerid")?.trim() ?? "";
  if (!/^\d+$/.test(yahooId)) return null;
  const name = (anchor.getAttribute("title") || anchor.textContent || "").trim();
  if (!name) return null;

  // Team + position lives in a sibling span with text shape "LAL - PG,SG".
  let team = "";
  for (const span of Array.from(row.querySelectorAll<HTMLElement>("span"))) {
    const text = (span.textContent ?? "").trim();
    const m = TEAM_POS_RE.exec(text);
    if (m) {
      team = m[1]!;
      break;
    }
  }
  if (!team) return null;
  return { yahooId, name, team };
}

export function scrapePlayers(): YahooPlayer[] {
  const table = findStatsTable();
  if (!table) return [];
  const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"));
  const out: YahooPlayer[] = [];
  for (const row of rows) {
    const p = scrapeRow(row);
    if (p) out.push(p);
  }
  return out;
}

export function findRowByYahooId(table: HTMLTableElement, yahooId: string): HTMLTableRowElement | null {
  return table.querySelector<HTMLTableRowElement>(
    `tbody tr:has(a[data-ys-playerid="${yahooId}"])`,
  );
}
