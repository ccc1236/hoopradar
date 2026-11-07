import { PER_MODES } from "./perModes.js";
import type { PerModeKey, WindowKey } from "./types.js";

export interface FilterSettings {
  window: WindowKey;
  perMode: PerModeKey;
}

export const DEFAULT_SETTINGS: FilterSettings = {
  window: "Season",
  perMode: "PerGame",
};

const KEY = "hoopradar.filterSettings";

function hasDirectStorage(): boolean {
  return (
    typeof chrome !== "undefined" &&
    chrome.storage !== undefined &&
    chrome.storage.sync !== undefined
  );
}

/** A value saved by an older version (e.g. the removed Per 100) falls back to the default. */
function sanitize(s: FilterSettings): FilterSettings {
  return PER_MODES.some((m) => m.key === s.perMode) ? s : { ...s, perMode: DEFAULT_SETTINGS.perMode };
}

export async function loadSettings(): Promise<FilterSettings> {
  if (hasDirectStorage()) {
    const r = await chrome.storage.sync.get(KEY);
    const saved = r[KEY];
    if (!saved || typeof saved !== "object") return { ...DEFAULT_SETTINGS };
    return sanitize({ ...DEFAULT_SETTINGS, ...(saved as Partial<FilterSettings>) });
  }
  // Fallback path: content script context where chrome.storage is not
  // accessible. Ask the SW to read it on our behalf.
  const resp = (await chrome.runtime.sendMessage({ type: "getSettings" })) as {
    type?: string;
    settings?: FilterSettings;
  } | null;
  if (resp && resp.type === "getSettingsResponse" && resp.settings) {
    return sanitize({ ...DEFAULT_SETTINGS, ...resp.settings });
  }
  return { ...DEFAULT_SETTINGS };
}

export async function saveSettings(patch: Partial<FilterSettings>): Promise<void> {
  if (hasDirectStorage()) {
    const current = await loadSettings();
    await chrome.storage.sync.set({ [KEY]: { ...current, ...patch } });
    return;
  }
  await chrome.runtime.sendMessage({ type: "saveSettings", patch });
}
