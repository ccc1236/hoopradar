// Fills the "Latest: vX.Y.Z, released D Mon YYYY" line under the download
// button from GitHub's public API. Any failure leaves the line hidden.

const API = "https://api.github.com/repos/ccc1236/hoopradar/releases/latest";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatLatest(release) {
  if (!release || typeof release.tag_name !== "string" || typeof release.published_at !== "string") return null;
  const d = new Date(release.published_at);
  if (Number.isNaN(d.getTime())) return null;
  return `Latest: ${release.tag_name}, released ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

async function init() {
  const el = document.querySelector("[data-latest]");
  if (!el) return;
  try {
    const res = await fetch(API, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) return;
    const text = formatLatest(await res.json());
    if (!text) return;
    el.textContent = text;
    el.hidden = false;
  } catch {
    // Offline, blocked or rate limited: the button still works without the line.
  }
}

if (typeof document !== "undefined") init();
