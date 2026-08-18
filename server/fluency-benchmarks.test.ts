import { describe, expect, it } from "vitest";
import { classifyFluency, getFluencyBenchmark } from "../client/src/lib/fluencyBenchmarks";

describe("teacher fluency references", () => {
  it("returns the grade-season reference points", () => {
    const benchmark = getFluencyBenchmark(3, "winter");
    expect(benchmark).toMatchObject({ p25: 79, p50: 97, p75: 137 });
    expect(classifyFluency(70, benchmark)).toBe("below");
    expect(classifyFluency(100, benchmark)).toBe("within");
    expect(classifyFluency(140, benchmark)).toBe("above");
  });

  it("does not manufacture a comparison outside supported grades", () => {
    const benchmark = getFluencyBenchmark(8, "spring");
    expect(benchmark).toBeNull();
    expect(classifyFluency(100, benchmark)).toBe("unavailable");
  });
});
