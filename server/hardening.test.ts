import { describe, expect, it } from "vitest";
import { applyCalibration } from "../client/src/lib/tracking";
import { compareTexts, appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function anonymousContext(): TrpcContext {
  return { user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

function ownerContext(): TrpcContext {
  const now = new Date();
  return { user: { id: 42, openId: "owner", name: "Teacher", email: "teacher@example.com", loginMethod: "test", role: "user", createdAt: now, updatedAt: now, lastSignedIn: now }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("production hardening", () => {
  it("calibration changes horizontal geometry predictably", () => {
    expect(applyCalibration(0.9, 0.75)).toBeGreaterThan(applyCalibration(0.9, 2.5));
    expect(applyCalibration(0.2, 0.75)).toBeGreaterThanOrEqual(0);
    expect(applyCalibration(0.8, 0.75)).toBeLessThanOrEqual(1);
  });

  it("scores oral reading and reports word-level differences", () => {
    const result = compareTexts("A seed waits under soil", "A seed waits above soil");
    expect(result.matchScore).toBe(80);
    expect(result.mismatches[0]).toContain("above");
  });

  it("blocks classroom data access without an authenticated owner", async () => {
    const caller = appRouter.createCaller(anonymousContext());
    await expect(caller.classroom.students()).rejects.toThrow("Please login");
  });

  it("rejects unsafe retention windows before any deletion or update runs", async () => {
    const caller = appRouter.createCaller(ownerContext());
    await expect(caller.privacy.setStudentRetention({ studentId: 1, retentionDays: 0 })).rejects.toThrow();
    await expect(caller.privacy.setStudentRetention({ studentId: 1, retentionDays: 4000 })).rejects.toThrow();
  });
});
