import { beforeEach, describe, expect, it } from "vitest";
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from "../../src/shared/settings.js";

describe("filter settings", () => {
  beforeEach(async () => {
    await chrome.storage.sync.clear();
  });

  it("returns defaults when nothing is saved", async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips saved settings", async () => {
    await saveSettings({ window: "Last5", perMode: "Per36" });
    expect(await loadSettings()).toEqual({ window: "Last5", perMode: "Per36" });
  });

  it("merges partial saves with defaults", async () => {
    await saveSettings({ window: "Last10" });
    const s = await loadSettings();
    expect(s.window).toBe("Last10");
    expect(s.perMode).toBe(DEFAULT_SETTINGS.perMode);
  });

  it("falls back to Per Game when an older version saved Per 100", async () => {
    await chrome.storage.sync.set({ "hoopradar.filterSettings": { window: "Last5", perMode: "Per100Possessions" } });
    expect(await loadSettings()).toEqual({ window: "Last5", perMode: "PerGame" });
  });

  it("falls back to Per Game through the service worker path too", async () => {
    const c = chrome as unknown as { storage: unknown; runtime: unknown };
    const { storage, runtime } = c;
    c.storage = undefined;
    c.runtime = {
      sendMessage: async () => ({
        type: "getSettingsResponse",
        settings: { window: "Last10", perMode: "Per100Possessions" },
      }),
    };
    try {
      expect(await loadSettings()).toEqual({ window: "Last10", perMode: "PerGame" });
    } finally {
      c.storage = storage;
      c.runtime = runtime;
    }
  });
});
