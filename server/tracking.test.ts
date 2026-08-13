import { describe, expect, it } from "vitest";
import { classifyRegionTransition, estimateHorizontalPosition, estimateMotionPoint } from "../client/src/lib/tracking";

describe("camera tracking helpers", () => {
  it("estimates horizontal position from changed frame pixels", () => {
    const previous = new Uint8ClampedArray(4 * 8);
    const current = new Uint8ClampedArray(previous);
    current[4 * 6] = 255;
    current[4 * 6 + 1] = 255;
    current[4 * 6 + 2] = 255;
    const result = estimateHorizontalPosition(current, previous, 8, 10);
    expect(result.position).toBeGreaterThan(0.7);
    expect(result.position).toBeLessThan(0.8);
    expect(result.normalizedMotion).toBeGreaterThan(0);
  });

  it("estimates a two-dimensional motion point", () => {
    const previous = new Uint8ClampedArray(4 * 4 * 4);
    const current = new Uint8ClampedArray(previous);
    const pixelIndex = 3 * 4 + 3;
    current[pixelIndex * 4] = 255;
    current[pixelIndex * 4 + 1] = 255;
    current[pixelIndex * 4 + 2] = 255;
    const result = estimateMotionPoint(current, previous, 4, 4, 10);
    expect(result.x).toBeGreaterThan(0.45);
    expect(result.y).toBeGreaterThan(0.65);
    expect(result.normalizedMotion).toBeGreaterThan(0);
  });

  it("classifies revisits and jumps from tracked regions", () => {
    const visited = new Set([1, 2]);
    expect(classifyRegionTransition(2, 1, visited)).toBe("reread");
    expect(classifyRegionTransition(2, 5, visited)).toBe("skip");
    expect(classifyRegionTransition(2, 3, visited)).toBe("advance");
  });
});
