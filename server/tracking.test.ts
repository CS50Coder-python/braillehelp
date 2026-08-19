import { describe, expect, it } from "vitest";
import { classifyRegionTransition, estimateHorizontalPosition, estimateMotionPoint, estimateVisualCandidate, stabilizeMotionPoint } from "../client/src/lib/tracking";

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

  it("acquires a visual candidate from a warm foreground patch", () => {
    const width = 20;
    const height = 12;
    const frame = new Uint8ClampedArray(width * height * 4);
    for (let y = 2; y < 10; y++) for (let x = 10; x < 19; x++) {
      const index = (y * width + x) * 4;
      frame[index] = 190;
      frame[index + 1] = 125;
      frame[index + 2] = 80;
      frame[index + 3] = 255;
    }
    const result = estimateVisualCandidate(frame, width, height);
    expect(result.detected).toBe(true);
    expect(result.x).toBeGreaterThan(0.5);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("does not acquire a candidate from an empty frame", () => {
    const frame = new Uint8ClampedArray(20 * 12 * 4);
    expect(estimateVisualCandidate(frame, 20, 12).detected).toBe(false);
  });

  it("does not detect a static frame", () => {
    const frame = new Uint8ClampedArray(4 * 4 * 4);
    const result = estimateMotionPoint(frame, new Uint8ClampedArray(frame), 4, 4);
    expect(result.detected).toBe(false);
    expect(result.changedRatio).toBe(0);
  });

  it("rejects implausible jumps and smooths nearby motion", () => {
    const candidate = { x: 0.6, y: 0.55, normalizedMotion: 0.2, detected: true, changedRatio: 0.04 };
    expect(stabilizeMotionPoint({ x: 0.1, y: 0.5 }, { ...candidate, x: 0.95 })).toBeNull();
    const smoothed = stabilizeMotionPoint({ x: 0.4, y: 0.5 }, candidate);
    expect(smoothed?.x).toBeGreaterThan(0.4);
    expect(smoothed?.x).toBeLessThan(0.6);
  });

  it("classifies revisits and jumps from tracked regions", () => {
    const visited = new Set([1, 2]);
    expect(classifyRegionTransition(2, 2, visited)).toBe("same_region");
    expect(classifyRegionTransition(2, 1, visited)).toBe("reread");
    expect(classifyRegionTransition(2, 5, visited)).toBe("skip");
    expect(classifyRegionTransition(2, 3, visited)).toBe("advance");
  });
});
