import { describe, expect, it } from "vitest";
import { hasAnalyzedPassage } from "../client/src/lib/readingGuard";

describe("reading passage precondition", () => {
  it("rejects sessions without a passage id or analyzed text", () => {
    expect(hasAnalyzedPassage(undefined, undefined)).toBe(false);
    expect(hasAnalyzedPassage(12, undefined)).toBe(false);
    expect(hasAnalyzedPassage(12, "   ")).toBe(false);
  });

  it("accepts a persisted passage with detected text", () => {
    expect(hasAnalyzedPassage(12, "The little seed")).toBe(true);
  });
});
