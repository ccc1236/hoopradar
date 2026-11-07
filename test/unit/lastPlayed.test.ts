import { describe, expect, it } from "vitest";
import { lastPlayedText, type LastPlayed } from "../../src/shared/lastPlayed.js";

const lp = (daysAgo: number): LastPlayed => ({ date: "2026-10-12T00:00:00", daysAgo, teamGamesSince: 0, old: true });

describe("lastPlayedText", () => {
  it("uses weeks from 7 days up", () => {
    expect(lastPlayedText(lp(21))).toBe("Last played Oct 12 (3 weeks ago)");
    expect(lastPlayedText(lp(20))).toBe("Last played Oct 12 (2 weeks ago)");
    expect(lastPlayedText(lp(7))).toBe("Last played Oct 12 (1 week ago)");
  });

  it("uses days below a week", () => {
    expect(lastPlayedText(lp(5))).toBe("Last played Oct 12 (5 days ago)");
    expect(lastPlayedText(lp(1))).toBe("Last played Oct 12 (1 day ago)");
  });

  it("keeps the date whatever the timezone", () => {
    expect(lastPlayedText({ ...lp(21), date: "2026-11-01T00:00:00" })).toContain("Nov 1 ");
  });
});
