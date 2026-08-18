import { describe, expect, it, vi } from "vitest";
import { gradeFromAge } from "../client/src/lib/fluencyBenchmarks";
import { announceStartCue, buildCalibrationProfile } from "../client/src/lib/sessionReadiness";

describe("reading session readiness", () => {
  it("requires and persists three distinct calibration samples", () => {
    expect(() => buildCalibrationProfile([{ heightMeters: 1.2, capturedAtMs: 1 }])).toThrow("Three calibration samples");
    const profile = buildCalibrationProfile([
      { heightMeters: 1.2, capturedAtMs: 1 },
      { heightMeters: 1.6, capturedAtMs: 2 },
      { heightMeters: 2.1, capturedAtMs: 3 },
    ]);
    expect(profile.calibrationHeight).toBeCloseTo(1.63);
    expect(profile.calibrationVersion).toContain("1.2-1.6-2.1");
    expect(profile.calibrationConfidence).toBeGreaterThan(0.8);
  });

  it("maps a supported age to a cautious grade proxy", () => {
    expect(gradeFromAge(8)).toBe(2);
    expect(gradeFromAge(14)).toBe(6);
    expect(gradeFromAge(5)).toBeNull();
  });

  it("announces the start cue before the reading timer begins", () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    class MockUtterance { rate = 0; pitch = 0; constructor(public text: string) {} }
    expect(announceStartCue({ speak, cancel }, MockUtterance)).toBe(true);
    expect(cancel).toHaveBeenCalledOnce();
    expect(speak).toHaveBeenCalledOnce();
    expect(speak.mock.calls[0][0].text).toBe("Ready. Begin reading now.");
  });
});
