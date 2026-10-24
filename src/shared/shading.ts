import type { YahooPlayerId } from "./types.js";

/** League mean and population SD of one stat in one window. */
export interface StatBaseline {
  mean: number;
  sd: number;
}

/** Per-stat baseline; null means too little data to shade that stat. */
export type ShadingBaseline = Partial<Record<string, StatBaseline | null>>;

export interface SampleInfo {
  small: boolean;
  gp: number;
  teamGames: number;
  mpg: number;
}

export interface ShadingPayload {
  baseline: ShadingBaseline;
  sampleByYahooId: Record<YahooPlayerId, SampleInfo | null>;
}

export const SHADED_KEYS = ["EFG_PCT", "TS_PCT", "USG_PCT"] as const;
