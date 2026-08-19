import { describe, expect, it } from "vitest";
import { HAND_TRACKING_WASM_ASSET, motionFallbackDetection, normalizeHandTrackingError, pickIndexFingertip } from "../client/src/lib/handTracking";

describe("index fingertip tracking", () => {
  it("selects landmark 8 and clamps its normalized position", () => {
    const landmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    landmarks[8] = { x: 1.2, y: -0.2, z: 0 };
    const result = pickIndexFingertip({ landmarks: [landmarks], handedness: [[{ score: 0.93, categoryName: "Right", displayName: "Right", index: 0 }]] } as never);
    expect(result).toEqual({ x: 1, y: 0, confidence: 0.93 });
  });

  it("converts camera motion into a bounded fallback tracking point", () => {
    expect(motionFallbackDetection({ x: 1.4, y: -0.2 })).toEqual({ x: 1, y: 0, confidence: 0.35 });
  });

  it("uses the known-good vision runtime and normalizes aborted failures", () => {
    expect(HAND_TRACKING_WASM_ASSET).toContain("cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm");
    expect(normalizeHandTrackingError(new Error("Aborted() - memory access"))).toContain("camera permission");
    expect(normalizeHandTrackingError(new Error("network request failed"))).toContain("network connection");
  });

  it("returns null when no hand is present", () => {
    expect(pickIndexFingertip({ landmarks: [], handedness: [] } as never)).toBeNull();
  });
});
