import type { SampleInfo, StatBaseline } from "../shared/shading.js";

/** Colours at z = -2, -1, 0, +1, +2 (see the 2026-10-24 shading design). */
const QUALITY = ["#ef9a9a", "#f5bf94", "#f9e595", "#b5d9a2", "#7dbb88"] as const;
const USAGE = ["#eceffa", "#d6dbf3", "#bfc8ec", "#a6b1e3", "#8d9ada"] as const;

const SCALES: Record<string, readonly string[]> = {
  EFG_PCT: QUALITY,
  TS_PCT: QUALITY,
  USG_PCT: USAGE,
};

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Background colour for a shaded stat cell: z-score against the window's
 * baseline, clamped to [-2, 2], linearly interpolated in RGB between stops.
 * Null when the stat is not shaded or the value or baseline is missing.
 */
export function colorFor(
  key: string,
  value: number | null | undefined,
  baseline: StatBaseline | null | undefined,
): string | null {
  const stops = SCALES[key];
  if (!stops || !baseline || typeof value !== "number" || !Number.isFinite(value)) return null;
  const z = Math.max(-2, Math.min(2, (value - baseline.mean) / baseline.sd));
  const pos = z + 2;
  const i = Math.min(Math.floor(pos), stops.length - 2);
  const t = pos - i;
  const a = rgb(stops[i]!);
  const b = rgb(stops[i + 1]!);
  return "#" + a.map((c, k) => Math.round(c + (b[k]! - c) * t).toString(16).padStart(2, "0")).join("");
}

export function sampleTitle(info: SampleInfo): string {
  return `Small sample: ${info.gp} of ${info.teamGames} team games, ${info.mpg.toFixed(1)} MPG`;
}
