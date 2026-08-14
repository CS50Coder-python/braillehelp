import { describe, expect, it } from "vitest";
import { handleAnalyzedPassageSelection } from "../client/src/pages/Home";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("analyzed passage camera entry", () => {
  it("persists successful analysis selection and enters the reading surface", () => {
    let selectedPassage: number | undefined;
    let nextView = "overview";
    const stored: Record<string, string> = {};
    handleAnalyzedPassageSelection(42, (id) => { selectedPassage = id; }, (view) => { nextView = view; }, { setItem: (key, value) => { stored[key] = value; }, removeItem: () => {} });
    expect(selectedPassage).toBe(42);
    expect(stored["braille-read-selected-passage"]).toBe("42");
    expect(nextView).toBe("read");
  });

  it("keeps the live camera and metric controls in the production session surface", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(source).toContain("Live camera preview");
    expect(source).toContain("Give start cue & begin");
    expect(source).toContain("Rereads");
    expect(source).toContain("Skipped regions");
    expect(source).toContain("Reading speed");
  });
});
