import { describe, it, expect } from "vitest";
import { colorFor, sampleTitle } from "../../src/content/shading.js";

const b = { mean: 0.55, sd: 0.05 };

describe("colorFor", () => {
  it("is yellow at the mean", () => {
    expect(colorFor("EFG_PCT", 0.55, b)).toBe("#f9e595");
  });

  it("hits the stops at +/-1 and +/-2", () => {
    expect(colorFor("TS_PCT", 0.60, b)).toBe("#b5d9a2");
    expect(colorFor("TS_PCT", 0.65, b)).toBe("#7dbb88");
    expect(colorFor("EFG_PCT", 0.50, b)).toBe("#f5bf94");
    expect(colorFor("EFG_PCT", 0.45, b)).toBe("#ef9a9a");
  });

  it("clamps beyond +/-2", () => {
    expect(colorFor("EFG_PCT", 1.0, b)).toBe("#7dbb88");
    expect(colorFor("EFG_PCT", 0.0, b)).toBe("#ef9a9a");
  });

  it("interpolates halfway between stops", () => {
    // z = 0.5 exactly, so the test is about interpolation, not float rounding.
    expect(colorFor("EFG_PCT", 0.5, { mean: 0, sd: 1 })).toBe("#d7df9c");
  });

  it("uses the blue scale for USG_PCT", () => {
    const u = { mean: 0.2, sd: 0.05 };
    expect(colorFor("USG_PCT", 0.2, u)).toBe("#bfc8ec");
    expect(colorFor("USG_PCT", 0.25, u)).toBe("#a6b1e3");
    expect(colorFor("USG_PCT", 0.1, u)).toBe("#eceffa");
  });

  it("returns null without a value, a baseline, or for an unshaded key", () => {
    expect(colorFor("EFG_PCT", null, b)).toBeNull();
    expect(colorFor("EFG_PCT", 0.5, null)).toBeNull();
    expect(colorFor("PTS", 20, b)).toBeNull();
  });
});

describe("sampleTitle", () => {
  it("formats the hover text", () => {
    expect(sampleTitle({ small: true, gp: 2, teamGames: 12, mpg: 6 })).toBe("Small sample: 2 of 12 team games, 6.0 MPG");
  });
});
