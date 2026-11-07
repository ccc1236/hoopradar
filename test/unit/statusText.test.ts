import { describe, expect, it } from "vitest";
import { loadingText, updatedText } from "../../src/pages/statusText.js";

describe("status text", () => {
  const now = new Date("2026-11-07T13:52:02");

  it("says updated when the data is current", () => {
    expect(updatedText({ staleSince: null }, now)).toBe(`Updated ${now.toLocaleTimeString()}`);
  });

  it("says when it is showing saved data", () => {
    const staleSince = new Date("2026-11-03T09:00:00").getTime();
    expect(updatedText({ staleSince }, now)).toBe("Couldn't update. Showing data from Nov 3");
  });

  it("names the game log download for the windows that need it", () => {
    expect(loadingText("Season")).toBe("Loading...");
    expect(loadingText("Last5")).toBe("Loading game logs...");
    expect(loadingText("Last10")).toBe("Loading game logs...");
  });
});
