export type PageKind = "myTeam" | "players" | "unknown";

export interface PageInfo {
  kind: PageKind;
  leagueId?: string;
}

const HOST = "basketball.fantasysports.yahoo.com";
// My Team URLs use either the literal "team" or a numeric team ID
// (e.g. /nba/9144/1), and since the 2026-27 season also the numeric ID
// followed by "/team" (e.g. /nba/624/1/team). The Players page is always
// literal "players".
const ROUTE_RE = /^\/nba\/([^/]+)\/(team|players|\d+(?:\/team)?)\/?$/;

export function detectPage(href: string): PageInfo {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { kind: "unknown" };
  }
  if (url.host !== HOST) return { kind: "unknown" };
  const m = ROUTE_RE.exec(url.pathname);
  if (!m) return { kind: "unknown" };
  const leagueId = m[1]!;
  const route = m[2]!;
  if (route === "players") return { kind: "players", leagueId };
  return { kind: "myTeam", leagueId };
}
