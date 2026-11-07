import type { WindowKey } from "../shared/types.js";

/** Filter bar text after a load. Saved numbers must never read as just updated. */
export function updatedText(resp: { staleSince: number | null }, now: Date): string {
  if (resp.staleSince === null) return `Updated ${now.toLocaleTimeString()}`;
  const day = new Date(resp.staleSince).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `Couldn't update. Showing data from ${day}`;
}

/** L5 and L10 may need a large game log download, so a slow first load shouldn't look stuck. */
export function loadingText(window: WindowKey): string {
  return window === "Season" ? "Loading..." : "Loading game logs...";
}
